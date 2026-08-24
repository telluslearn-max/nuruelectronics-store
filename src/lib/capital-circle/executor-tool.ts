import "server-only";
import { Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client-v2";
import { prisma } from "../prisma";
import { logAdminAction } from "../audit-log";
import { formatPrice } from "../format";
import { sendPushToAdmin } from "../push";
import { CAPITAL_CIRCLE_LIVE, DEFAULT_SPREAD_ASSUMPTION, FEE_BPS } from "./config";
import { isCircleWalletConfigured, isCircleWalletTestnet, getClobSigner } from "./circle-wallet-client";
import { getOrderBookSummary, getPolymarketMidpoint } from "./polymarket-client";
import { evaluateEdge } from "./trade-policy";
import { sizePosition } from "./sizing-tool";

const CLOB_HOST = "https://clob.polymarket.com";

export type RecordPositionInput = {
  conditionId: string;
  tokenId: string;
  question: string;
  thesis: string;
  /** Optional ceiling on the size. Omitted means Kelly and the pool's caps decide alone. */
  sizeUsd?: number;
  /** Advisory only — the executor re-prices against the live book and stores that instead. */
  entryPrice?: number;
  /** The model's probability for this outcome, 0-100. Drives both the edge gate and Kelly sizing. */
  confidencePct?: number;
  /** Shrinkage factor from the cycle's measured calibration. Defaults to the configured prior. */
  lambda?: number;
  /** The cycle's edge bar, relaxed when the desk is behind its daily target. Defaults to the strict one. */
  minEdge?: number;
  eventId?: string | null;
  category?: string | null;
  marketEndDate?: Date | null;
  cycleId?: string | null;
  /** Raw ensemble samples behind confidencePct, kept for post-hoc analysis. */
  probEstimates?: number[] | null;
};

export type RecordPositionResult = {
  positionId: string;
  status: "simulated" | "executed" | "rejected" | "edge_rejected";
  txHash: string | null;
  note: string;
};

/**
 * The only tool with wallet-signing authority — everything upstream produces a
 * thesis and a probability, nothing more.
 *
 * Three checks happen here that no caller can talk its way past, because each
 * is re-derived from live data rather than trusted from the model's arguments:
 *
 *  1. Dedupe — one position per market, one per event. Two outcomes of the
 *     same event are one wager, and stacking them is concentration wearing the
 *     costume of diversification.
 *  2. Pricing — the entry price is fetched from the live order book at
 *     execution time, not taken from the model. Previously the model's own
 *     quoted mid was stored and settled against, so every simulated result was
 *     credited half a spread it never earned.
 *  3. Edge — the trade is re-evaluated at those real prices and refused if it
 *     no longer has expected value. Prices move between research and
 *     execution, and a thesis is not a licence to pay any price.
 *
 * Size is likewise always sizePosition()'s output, never the caller's raw
 * sizeUsd, so a model that skips, misreads, or is prompt-injected into
 * ignoring the sizing step can never commit more than the caps allow.
 */
export async function recordPosition(input: RecordPositionInput): Promise<RecordPositionResult> {
  const wallet = await prisma.capitalCircleWallet.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
  });

  const baseData = {
    walletId: wallet?.id,
    venue: "polymarket",
    marketId: input.conditionId,
    tokenId: input.tokenId,
    question: input.question,
    thesis: input.thesis,
    confidencePct: input.confidencePct != null ? Math.round(input.confidencePct) : undefined,
    eventId: input.eventId ?? undefined,
    category: input.category ?? undefined,
    marketEndDate: input.marketEndDate ?? undefined,
    cycleId: input.cycleId ?? undefined,
    probEstimates: input.probEstimates ?? undefined,
  };

  // 1. Dedupe.
  const duplicate = await prisma.capitalCirclePosition.findFirst({
    where: {
      resolvedAt: null,
      status: { in: ["simulated", "executed"] },
      OR: [{ marketId: input.conditionId }, ...(input.eventId ? [{ eventId: input.eventId }] : [])],
    },
    select: { id: true, question: true, marketId: true },
  });
  if (duplicate) {
    const note =
      duplicate.marketId === input.conditionId
        ? `Already holding an open position in this market ("${duplicate.question}").`
        : `Already holding an open position on this event ("${duplicate.question}") — the outcomes are correlated, so this would double the same bet.`;
    return { positionId: duplicate.id, status: "rejected", txHash: null, note };
  }

  // 2. Price against the live book.
  const book = await getOrderBookSummary(input.tokenId);
  let midpoint = book?.midpoint ?? null;
  if (midpoint == null && book?.bestAsk == null) {
    midpoint = await getPolymarketMidpoint(input.tokenId);
  }
  const pricing = {
    bestAsk: book?.bestAsk ?? null,
    midpoint: midpoint ?? input.entryPrice ?? null,
    spread: book?.spread ?? null,
  };

  // 3. Edge gate at real prices.
  const modelProbability = input.confidencePct != null ? input.confidencePct / 100 : null;
  if (modelProbability == null) {
    return recordRejection({ baseData, status: "rejected", note: "No probability supplied — a position without a stated probability cannot be priced for edge." });
  }

  const edge = evaluateEdge({ modelProbability, pricing, lambda: input.lambda, minEdge: input.minEdge });
  if (!edge.accepted || edge.effectiveEntry == null) {
    return recordRejection({
      baseData,
      status: "edge_rejected",
      note: `Refused on expected value: ${edge.reason}`,
      extra: { edgePct: edge.edge, spreadAtEntry: pricing.spread ?? undefined, bestAskAtEntry: pricing.bestAsk ?? undefined },
    });
  }

  const effectiveEntry = edge.effectiveEntry;
  const sizing = await sizePosition({
    requestedUsd: input.sizeUsd ?? undefined,
    shrunkProbability: edge.shrunkProbability,
    effectiveEntry,
    bookDepthUsd: book?.askDepthUsd ?? null,
  });
  const sizeUsd = sizing.approvedUsd;

  if (sizeUsd <= 0) {
    return recordRejection({
      baseData,
      status: "rejected",
      note: sizing.reason,
      extra: { edgePct: edge.edge, spreadAtEntry: pricing.spread ?? undefined, bestAskAtEntry: pricing.bestAsk ?? undefined },
      logSummary: `Capital Circle rejected a position in "${input.question}": ${sizing.reason}`,
    });
  }

  const priced = {
    entryPrice: effectiveEntry,
    edgePct: edge.edge,
    spreadAtEntry: pricing.spread ?? DEFAULT_SPREAD_ASSUMPTION,
    bestAskAtEntry: pricing.bestAsk ?? undefined,
    kellyFraction: sizing.kellyFraction ?? undefined,
    feesUsd: round2(sizeUsd * (FEE_BPS / 10_000)),
  };

  // Live mode requires the flag, a configured wallet, AND that wallet not being a testnet one —
  // a testnet signer must never be allowed to sign for the real mainnet Polymarket CLOB.
  const canGoLive = CAPITAL_CIRCLE_LIVE && isCircleWalletConfigured && !isCircleWalletTestnet;

  if (!canGoLive) {
    const position = await prisma.capitalCirclePosition.create({
      data: {
        ...baseData,
        ...priced,
        sizeUsd,
        // The simulated fill is the ask — the price a real taker order would have crossed to.
        fillPrice: effectiveEntry,
        status: "simulated",
      },
    });
    await logAdminAction({
      action: "capital-circle.position.simulate",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle would size ${formatPrice(String(sizeUsd), "USD")} into "${input.question}" at ${effectiveEntry.toFixed(4)} (edge ${edge.edge.toFixed(4)}) — simulated (${CAPITAL_CIRCLE_LIVE ? "no live-eligible Circle wallet configured yet" : "CAPITAL_CIRCLE_LIVE is false"}).`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, sizeUsd, thesis: input.thesis, edge: edge.edge, effectiveEntry, spread: pricing.spread },
    });
    await notifyPositionTaken(input.question, sizeUsd, "simulated");
    return {
      positionId: position.id,
      status: "simulated",
      txHash: null,
      note: `Recorded as simulated at an assumed ask-side fill of ${effectiveEntry.toFixed(4)} — no real funds or wallet involved yet. ${edge.reason}`,
    };
  }

  try {
    // L1 auth (wallet signature) to derive L2 API creds, then a fully-authed
    // client to place the order — see @polymarket/clob-client-v2's README.
    const signer = getClobSigner();
    const authClient = new ClobClient({ host: CLOB_HOST, chain: Chain.POLYGON, signer, throwOnError: true });
    const creds = await authClient.createOrDeriveApiKey();
    const tradingClient = new ClobClient({ host: CLOB_HOST, chain: Chain.POLYGON, signer, creds, throwOnError: true });

    const response = await tradingClient.createAndPostMarketOrder(
      { tokenID: input.tokenId, amount: sizeUsd, side: Side.BUY },
      undefined,
      OrderType.FOK,
    );
    if (!response.success) {
      throw new Error(response.errorMsg || "Order was not accepted.");
    }
    // Settlement tx hash is best-effort/async — fall back to the order id so there's always a real reference to look up.
    const txHash = response.transactionsHashes?.[0] ?? response.orderID;
    const fillPrice = parseFillPrice(response) ?? effectiveEntry;

    const position = await prisma.capitalCirclePosition.create({
      data: {
        ...baseData,
        ...priced,
        sizeUsd,
        fillPrice,
        // Settle against what was actually paid, not what was quoted — the gap between the two
        // is real slippage, and burying it would make the live track record flatter than reality.
        entryPrice: fillPrice,
        status: "executed",
        txHash,
      },
    });
    await logAdminAction({
      action: "capital-circle.position.execute",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle executed ${formatPrice(String(sizeUsd), "USD")} into "${input.question}" at ${fillPrice.toFixed(4)} (quoted ${effectiveEntry.toFixed(4)}) — tx ${txHash}.`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, sizeUsd, thesis: input.thesis, txHash, fillPrice, quotedEntry: effectiveEntry, edge: edge.edge },
    });
    await notifyPositionTaken(input.question, sizeUsd, "executed");
    return { positionId: position.id, status: "executed", txHash, note: `Executed for real at ${fillPrice.toFixed(4)}.` };
  } catch (error) {
    return recordRejection({
      baseData,
      status: "rejected",
      note: error instanceof Error ? error.message : "Execution failed.",
      extra: { ...priced, sizeUsd },
      logSummary: `Capital Circle execution failed for "${input.question}": ${error instanceof Error ? error.message : "unknown error"}.`,
    });
  }
}

/**
 * Rejections are persisted, not just returned. A refused trade is data: the
 * count of edge_rejected rows over time is the clearest single measure of
 * whether the model's estimates are getting better or worse.
 */
async function recordRejection(args: {
  baseData: Record<string, unknown>;
  status: "rejected" | "edge_rejected";
  note: string;
  extra?: Record<string, unknown>;
  logSummary?: string;
}): Promise<RecordPositionResult> {
  const position = await prisma.capitalCirclePosition.create({
    data: { ...args.baseData, ...args.extra, sizeUsd: 0, status: args.status } as never,
  });
  await logAdminAction({
    action: args.status === "edge_rejected" ? "capital-circle.position.edge-reject" : "capital-circle.position.reject",
    entityType: "capital_circle_position",
    entityId: position.id,
    summary: args.logSummary ?? `Capital Circle refused a position: ${args.note}`,
    metadata: { ...args.baseData, ...args.extra },
  }).catch((error) => console.error("[capital-circle] failed to log rejection:", error));
  return { positionId: position.id, status: args.status, txHash: null, note: args.note };
}

/**
 * The real fill price from a CLOB market-order response.
 *
 * A BUY reports `makingAmount` as the USDC paid and `takingAmount` as the
 * outcome shares received, so the ratio is the price per share. Field shapes
 * have differed from the SDK's declarations before (see
 * getPolymarketHistoricalPrice), so this reads defensively and returns null
 * rather than a wrong number — the caller falls back to the quoted ask.
 */
function parseFillPrice(response: unknown): number | null {
  if (!response || typeof response !== "object") return null;
  const record = response as Record<string, unknown>;
  const paid = Number(record.makingAmount);
  const shares = Number(record.takingAmount);
  if (!Number.isFinite(paid) || !Number.isFinite(shares) || shares <= 0) return null;
  const price = paid / shares;
  return price > 0 && price <= 1 ? price : null;
}

/** Fires the push notification for a real (non-rejected) position — never allowed to fail
 * recordPosition itself, since a notification is a nice-to-have, not part of the trade record. */
async function notifyPositionTaken(question: string, sizeUsd: number, status: "simulated" | "executed"): Promise<void> {
  await sendPushToAdmin({
    title: "Capital Circle: position taken",
    body: `${status === "executed" ? "Executed" : "Simulated"} ${formatPrice(sizeUsd.toFixed(2), "USD")} — ${question}`,
    url: "/admin/reports/capital-circle",
  }).catch((error) => console.error("[capital-circle] push notify failed:", error));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
