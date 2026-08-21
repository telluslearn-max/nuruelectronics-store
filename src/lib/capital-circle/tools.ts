import "server-only";
import type { FunctionDeclaration } from "@google/genai";
import { sizePosition } from "./sizing-tool";
import { recordPosition, type RecordPositionInput } from "./executor-tool";
import { getOrderBookSummary, getPricesHistoryForModel } from "./polymarket-client";
import { payForResource } from "./x402-pay";
import { logAdminAction } from "../audit-log";

/**
 * Tools for the deep-dive stage only.
 *
 * Market discovery is deliberately no longer a tool: candidates are fetched,
 * screened for liquidity and spread, and priced in code before this stage
 * runs. A model that can call for its own market list can also pick from an
 * unscreened one, and the screening is the part that keeps untradeable
 * markets out of the portfolio.
 */

const getOrderBookDeclaration: FunctionDeclaration = {
  name: "get_order_book",
  description:
    "Live order book for one outcome token: best bid, best ask, midpoint, spread, and the USD resting on each side. Use this to check what an entry actually costs and whether the book is deep enough to get in and out — a quoted price with no depth behind it is not a price you can trade.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      tokenId: { type: "string", description: "The outcome token id from the proposed trade." },
    },
    required: ["tokenId"],
  },
};

const getPriceHistoryDeclaration: FunctionDeclaration = {
  name: "get_price_history",
  description:
    "Recent price history for one outcome token, with the movement already computed: change over 1h/6h/24h, volatility, and the 24h high and low. Use it to check whether the market has already moved to price in the thing your thesis rests on.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      tokenId: { type: "string", description: "The outcome token id from the proposed trade." },
      hours: { type: "integer", description: "How far back to look. Defaults to 24." },
    },
    required: ["tokenId"],
  },
};

const sizePositionDeclaration: FunctionDeclaration = {
  name: "size_position",
  description:
    "Check the risk-bounded size available for a trade. Informational — record_position re-derives the real size itself from the trade's edge and the pool's caps, so you never need to pass a size through.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      requestedUsd: { type: "number", description: "The USD size you're considering, before risk limits." },
    },
    required: ["requestedUsd"],
  },
};

const recordPositionDeclaration: FunctionDeclaration = {
  name: "record_position",
  description:
    "Confirm a proposed trade and record it. Re-prices against the live order book, re-checks the expected edge at that real price, and sizes the position itself — it will refuse the trade outright if the edge no longer holds, if you already hold this market or event, or if the pool's limits are reached. A refusal is a real answer; do not retry it with different numbers.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      conditionId: { type: "string", description: "The market's condition id, exactly as given in the proposed trade." },
      tokenId: { type: "string", description: "The outcome token id, exactly as given in the proposed trade." },
      question: { type: "string", description: "The market's exact question text." },
      thesis: { type: "string", description: "What you think happens before this market resolves, why, and what would prove it wrong." },
      confidencePct: {
        type: "integer",
        description:
          "Your probability that this outcome resolves YES, 0-100. Scored against the real outcome as a Brier score and shown back to you in later cycles — state what you actually believe, not what justifies the trade.",
      },
      sizeUsd: { type: "number", description: "The size your thesis justifies. Treated as a ceiling: the real size comes from the trade's edge and the pool's caps." },
    },
    required: ["conditionId", "tokenId", "question", "thesis", "confidencePct"],
  },
};

const fetchPaidMarketDataDeclaration: FunctionDeclaration = {
  name: "fetch_paid_market_data",
  description:
    "Fetch data from a paid market-intelligence service via x402 (pay-per-call USDC), for services the app has explicitly allowlisted. Use this when public Polymarket data alone isn't enough to check a thesis. Calling a non-allowlisted URL or exceeding the per-call price cap fails with a clear error — never invent data in place of a failed call.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL of the paid endpoint to call. Must be on the app's X402_ALLOWED_HOSTS allowlist." },
    },
    required: ["url"],
  },
};

export const functionDeclarations: FunctionDeclaration[] = [
  getOrderBookDeclaration,
  getPriceHistoryDeclaration,
  sizePositionDeclaration,
  recordPositionDeclaration,
  fetchPaidMarketDataDeclaration,
];

/** Per-cycle context the dispatcher needs but the model has no business supplying itself. */
export type ToolContext = {
  cycleId: string | null;
  lambda: number;
  /** This cycle's edge bar, already relaxed if the desk is behind on its daily target. */
  minEdge?: number;
  /** The trades the edge gate approved, keyed by tokenId — record_position may only confirm one of these. */
  approvedTrades: Map<string, ApprovedTrade>;
};

export type ApprovedTrade = {
  conditionId: string;
  tokenId: string;
  question: string;
  /** Optional ceiling. Null means "no ceiling beyond the pool's own caps". */
  sizeUsd: number | null;
  /**
   * The confidence-adjusted λ this specific trade was selected at (see disagreementAdjustedLambda).
   * Falls back to the cycle-wide λ when absent. Present so record_position's independent re-price
   * applies the same trust level that approved the trade rather than the more generous global one.
   */
  lambda?: number;
  eventId: string | null;
  category: string | null;
  marketEndDate: Date | null;
  probEstimates: number[] | null;
};

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<{ resultForModel: unknown }> {
  switch (name) {
    case "get_order_book": {
      const tokenId = typeof args.tokenId === "string" ? args.tokenId : "";
      if (!tokenId) return { resultForModel: { error: "Missing tokenId." } };
      const book = await getOrderBookSummary(tokenId);
      if (!book) return { resultForModel: { error: "No order book available for that token right now." } };
      return { resultForModel: book };
    }

    case "get_price_history": {
      const tokenId = typeof args.tokenId === "string" ? args.tokenId : "";
      if (!tokenId) return { resultForModel: { error: "Missing tokenId." } };
      const hours = typeof args.hours === "number" && args.hours > 0 ? args.hours : 24;
      const history = await getPricesHistoryForModel(tokenId, hours);
      if (!history) return { resultForModel: { error: "No price history available for that token." } };
      return { resultForModel: history };
    }

    case "size_position": {
      const requestedUsd = typeof args.requestedUsd === "number" ? args.requestedUsd : NaN;
      if (Number.isNaN(requestedUsd)) {
        return { resultForModel: { error: "Missing or invalid requestedUsd." } };
      }
      return { resultForModel: await sizePosition({ requestedUsd }) };
    }

    case "record_position": {
      const tokenId = typeof args.tokenId === "string" ? args.tokenId : "";
      const thesis = typeof args.thesis === "string" ? args.thesis : "";
      const confidencePct = typeof args.confidencePct === "number" ? args.confidencePct : NaN;
      if (!tokenId || !thesis || Number.isNaN(confidencePct)) {
        return { resultForModel: { error: "Missing tokenId, thesis, or confidencePct." } };
      }

      // Only trades the edge gate already approved can be recorded. Identifiers come from
      // that record rather than from the model's arguments, so a mistyped or invented
      // condition id can't attach a thesis to the wrong market.
      const approved = context.approvedTrades.get(tokenId);
      if (!approved) {
        return {
          resultForModel: {
            error: "That outcome token isn't one of this cycle's approved trades. You can only confirm or veto what was proposed to you — you cannot add a trade.",
          },
        };
      }

      const input: RecordPositionInput = {
        conditionId: approved.conditionId,
        tokenId: approved.tokenId,
        question: approved.question,
        thesis,
        sizeUsd: typeof args.sizeUsd === "number" ? args.sizeUsd : (approved.sizeUsd ?? undefined),
        confidencePct,
        lambda: approved.lambda ?? context.lambda,
        minEdge: context.minEdge,
        eventId: approved.eventId,
        category: approved.category,
        marketEndDate: approved.marketEndDate,
        cycleId: context.cycleId,
        probEstimates: approved.probEstimates,
      };
      return { resultForModel: await recordPosition(input) };
    }

    case "fetch_paid_market_data": {
      const url = typeof args.url === "string" ? args.url : "";
      if (!url) {
        return { resultForModel: { error: "Missing url." } };
      }
      try {
        const response = await payForResource(url);
        const contentType = response.headers.get("content-type") ?? "";
        const body = contentType.includes("application/json") ? await response.json() : await response.text();
        if (!response.ok) {
          return { resultForModel: { error: `Request failed (HTTP ${response.status}).`, body } };
        }
        return { resultForModel: body };
      } catch (error) {
        return { resultForModel: { error: error instanceof Error ? error.message : "Payment or fetch failed." } };
      }
    }

    default:
      return { resultForModel: { error: `Unknown tool "${name}".` } };
  }
}

/**
 * Records what the screening actually returned, separately from the model's
 * own account of it.
 *
 * This caught a real discrepancy once: a cycle reported that all available
 * markets resolved far in the future while a manual check moments later showed
 * markets under two hours away. Without an independent log of the tool's real
 * output, there was no way to tell a data gap from the model misdescribing
 * what it saw — and the summary is the only other record of a no-trade hour.
 * Never propagates: a logging failure must not surface as a research failure.
 */
export async function logCandidateSlate(
  cycleId: string,
  candidates: { question: string; hoursToResolution: number; tokens: { outcome: string; price: number }[]; liquidity: number | null; volume24hr: number | null }[],
  dropped: { question: string; reason: string }[],
): Promise<void> {
  try {
    await logAdminAction({
      action: "capital-circle.research.markets-returned",
      entityType: "capital_circle_research",
      summary: `Screening returned ${candidates.length} tradeable candidate(s) from the resolution window; ${dropped.length} were dropped.`,
      metadata: {
        cycleId,
        count: candidates.length,
        markets: candidates.map((market) => ({
          question: market.question,
          hoursAway: Number(market.hoursToResolution.toFixed(2)),
          // Prices at research time, so a summary's specific price claims stay checkable
          // after the fact — prices move continuously, so nothing else can verify them later.
          prices: market.tokens.map((token) => `${token.outcome}: ${token.price}`).join(", "),
          liquidity: market.liquidity,
          volume24hr: market.volume24hr,
        })),
        dropped: dropped.slice(0, 30),
      },
    });
  } catch (error) {
    console.error("[capital-circle] failed to log candidate slate:", error);
  }
}
