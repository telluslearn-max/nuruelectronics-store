import "server-only";
import { Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client-v2";
import { prisma } from "../prisma";
import { logAdminAction } from "../audit-log";
import { formatPrice } from "../format";
import { sendPushToAdmin } from "../push";
import { CAPITAL_CIRCLE_LIVE } from "./config";
import { isCircleWalletConfigured, isCircleWalletTestnet, getClobSigner } from "./circle-wallet-client";
import { sizePosition } from "./sizing-tool";

const CLOB_HOST = "https://clob.polymarket.com";

export type RecordPositionInput = {
  conditionId: string;
  tokenId: string;
  question: string;
  thesis: string;
  sizeUsd: number;
  /** The bought outcome token's implied price (0-1) at decision time, from a prior
   * research_polymarket_markets result — stored so the settlement job can compute win/loss once
   * the market resolves. Optional only because callers that skip it lose settlement, not because
   * it's meaningful to omit; record_position's tool schema marks it required. */
  entryPrice?: number;
  /** The model's own 0-100 conviction in this thesis, separate from entryPrice (the market's own
   * implied probability) — see tools.ts's record_position schema. */
  confidencePct?: number;
};

export type RecordPositionResult = {
  positionId: string;
  status: "simulated" | "executed" | "rejected";
  txHash: string | null;
  note: string;
};

/**
 * The only tool with wallet-signing authority — everything upstream (research-tool,
 * sizing-tool) only ever produces a thesis and a bounded size. Callers are instructed to call
 * size_position first and pass its approved amount here, but that's an English instruction, not
 * an enforced contract — this function re-derives the real approved size itself via
 * sizePosition(), so a model that skips, misreads, or is prompt-injected into ignoring
 * size_position's response can never record or execute more than the wallet's own caps allow.
 * The size actually used is always sizePosition()'s output, never the caller's raw sizeUsd.
 */
export async function recordPosition(input: RecordPositionInput): Promise<RecordPositionResult> {
  const wallet = await prisma.capitalCircleWallet.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
  });

  const sizing = await sizePosition(input.sizeUsd);
  const sizeUsd = sizing.approvedUsd;

  if (sizeUsd <= 0) {
    const position = await prisma.capitalCirclePosition.create({
      data: {
        walletId: wallet?.id,
        venue: "polymarket",
        marketId: input.conditionId,
        tokenId: input.tokenId,
        question: input.question,
        thesis: input.thesis,
        sizeUsd: 0,
        entryPrice: input.entryPrice,
        confidencePct: input.confidencePct,
        status: "rejected",
      },
    });
    await logAdminAction({
      action: "capital-circle.position.reject",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle rejected a $${input.sizeUsd.toFixed(2)} request into "${input.question}": ${sizing.reason}`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, requestedUsd: input.sizeUsd, thesis: input.thesis },
    });
    return { positionId: position.id, status: "rejected", txHash: null, note: sizing.reason };
  }

  // Live mode requires the flag, a configured wallet, AND that wallet not being a testnet one —
  // a testnet signer must never be allowed to sign for the real mainnet Polymarket CLOB.
  const canGoLive = CAPITAL_CIRCLE_LIVE && isCircleWalletConfigured && !isCircleWalletTestnet;

  if (!canGoLive) {
    const position = await prisma.capitalCirclePosition.create({
      data: {
        walletId: wallet?.id,
        venue: "polymarket",
        marketId: input.conditionId,
        tokenId: input.tokenId,
        question: input.question,
        thesis: input.thesis,
        sizeUsd,
        entryPrice: input.entryPrice,
        confidencePct: input.confidencePct,
        status: "simulated",
      },
    });
    await logAdminAction({
      action: "capital-circle.position.simulate",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle would size $${sizeUsd.toFixed(2)} into "${input.question}" — simulated (${CAPITAL_CIRCLE_LIVE ? "no live-eligible Circle wallet configured yet" : "CAPITAL_CIRCLE_LIVE is false"}).`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, sizeUsd, thesis: input.thesis },
    });
    await notifyPositionTaken(input.question, sizeUsd, "simulated");
    return {
      positionId: position.id,
      status: "simulated",
      txHash: null,
      note: "Recorded as simulated — no real funds or wallet involved yet.",
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

    const position = await prisma.capitalCirclePosition.create({
      data: {
        walletId: wallet?.id,
        venue: "polymarket",
        marketId: input.conditionId,
        tokenId: input.tokenId,
        question: input.question,
        thesis: input.thesis,
        sizeUsd,
        entryPrice: input.entryPrice,
        confidencePct: input.confidencePct,
        status: "executed",
        txHash,
      },
    });
    await logAdminAction({
      action: "capital-circle.position.execute",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle executed $${sizeUsd.toFixed(2)} into "${input.question}" — tx ${txHash}.`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, sizeUsd, thesis: input.thesis, txHash },
    });
    await notifyPositionTaken(input.question, sizeUsd, "executed");
    return { positionId: position.id, status: "executed", txHash, note: "Executed for real." };
  } catch (error) {
    const position = await prisma.capitalCirclePosition.create({
      data: {
        walletId: wallet?.id,
        venue: "polymarket",
        marketId: input.conditionId,
        tokenId: input.tokenId,
        question: input.question,
        thesis: input.thesis,
        sizeUsd,
        entryPrice: input.entryPrice,
        confidencePct: input.confidencePct,
        status: "rejected",
      },
    });
    await logAdminAction({
      action: "capital-circle.position.reject",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle execution failed for "${input.question}": ${error instanceof Error ? error.message : "unknown error"}.`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, sizeUsd },
    });
    return {
      positionId: position.id,
      status: "rejected",
      txHash: null,
      note: error instanceof Error ? error.message : "Execution failed.",
    };
  }
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
