import "server-only";
import type { FunctionDeclaration } from "@google/genai";
import { researchPolymarketMarkets } from "./research-tool";
import { sizePosition } from "./sizing-tool";
import { recordPosition } from "./executor-tool";
import { payForResource } from "./x402-pay";
import { logAdminAction } from "../audit-log";

const researchPolymarketMarketsDeclaration: FunctionDeclaration = {
  name: "research_polymarket_markets",
  description: "List real, live, active Polymarket prediction markets resolving within the next 2 hours — question, condition id, and each outcome's token id, label (e.g. Yes/No), and current implied price. Never invent a market, outcome, or price — always call this before referencing one.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "Max markets to return. Defaults to 20." },
    },
  },
};

const sizePositionDeclaration: FunctionDeclaration = {
  name: "size_position",
  description: "Get the risk-bounded approved USD size for a position you want to take. Always call this before record_position — never decide a size yourself.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      requestedUsd: { type: "number", description: "The USD size your thesis justifies, before risk limits are applied." },
    },
    required: ["requestedUsd"],
  },
};

const recordPositionDeclaration: FunctionDeclaration = {
  name: "record_position",
  description: "Record the decision — thesis, market, and the approved size from size_position. This is the only tool that ever touches a real position.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      conditionId: { type: "string", description: "The exact condition_id from a prior research_polymarket_markets result." },
      tokenId: { type: "string", description: "The exact outcome token id from a prior research_polymarket_markets result." },
      question: { type: "string", description: "The market's exact question text." },
      thesis: { type: "string", description: "Your written thesis: what, why, and what would invalidate it." },
      sizeUsd: { type: "number", description: "The approved size from size_position's response — not your original request." },
    },
    required: ["conditionId", "tokenId", "question", "thesis", "sizeUsd"],
  },
};

const fetchPaidMarketDataDeclaration: FunctionDeclaration = {
  name: "fetch_paid_market_data",
  description:
    "Fetch data from a paid market-intelligence service via x402 (pay-per-call USDC), for services the app has explicitly allowlisted. Use this when public Polymarket data alone isn't enough to form or check a thesis. Calling a non-allowlisted URL or exceeding the per-call price cap fails with a clear error — never invent data in place of a failed call.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL of the paid endpoint to call. Must be on the app's X402_ALLOWED_HOSTS allowlist." },
    },
    required: ["url"],
  },
};

export const functionDeclarations: FunctionDeclaration[] = [
  researchPolymarketMarketsDeclaration,
  sizePositionDeclaration,
  recordPositionDeclaration,
  fetchPaidMarketDataDeclaration,
];

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ resultForModel: unknown }> {
  switch (name) {
    case "research_polymarket_markets": {
      const limit = typeof args.limit === "number" ? args.limit : undefined;
      try {
        const markets = await researchPolymarketMarkets(limit);
        // The model's own final summary is the only other record of a "no trade" week — logging
        // what the tool actually returned means that claim can be checked against real data
        // afterward, rather than trusted at face value. Caught mattering for real: one cycle
        // claimed "all available markets had resolution dates far in the future" when a manual
        // recheck moments later showed real markets 0.6-1.7h away — this log is what would have
        // settled whether that was a data gap or the model misdescribing what it saw.
        await logAdminAction({
          action: "capital-circle.research.markets-returned",
          entityType: "capital_circle_research",
          summary: `research_polymarket_markets returned ${markets.length} market(s) within the resolution window.`,
          metadata: {
            count: markets.length,
            markets: markets.map((m) => ({
              question: m.question,
              hoursAway: Number(((m.endDate.getTime() - Date.now()) / 3600000).toFixed(2)),
              // Prices at research time, not just which markets existed — so a summary's specific
              // price claims (e.g. "Up: 0.9675") are checkable after the fact too, not just its
              // list of market names. Prices move continuously, so this is the only way to verify
              // a past claim once time has passed.
              prices: m.tokens.map((t) => `${t.outcome}: ${t.price}`).join(", "),
            })),
          },
        });
        return { resultForModel: markets };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch markets.";
        await logAdminAction({
          action: "capital-circle.research.markets-failed",
          entityType: "capital_circle_research",
          summary: `research_polymarket_markets failed: ${message}`,
          metadata: { error: message },
        });
        return { resultForModel: { error: message } };
      }
    }

    case "size_position": {
      const requestedUsd = typeof args.requestedUsd === "number" ? args.requestedUsd : NaN;
      if (Number.isNaN(requestedUsd)) {
        return { resultForModel: { error: "Missing or invalid requestedUsd." } };
      }
      const result = await sizePosition(requestedUsd);
      return { resultForModel: result };
    }

    case "record_position": {
      const conditionId = typeof args.conditionId === "string" ? args.conditionId : "";
      const tokenId = typeof args.tokenId === "string" ? args.tokenId : "";
      const question = typeof args.question === "string" ? args.question : "";
      const thesis = typeof args.thesis === "string" ? args.thesis : "";
      const sizeUsd = typeof args.sizeUsd === "number" ? args.sizeUsd : NaN;
      if (!conditionId || !tokenId || !question || !thesis || Number.isNaN(sizeUsd)) {
        return { resultForModel: { error: "Missing conditionId, tokenId, question, thesis, or sizeUsd." } };
      }
      const result = await recordPosition({ conditionId, tokenId, question, thesis, sizeUsd });
      return { resultForModel: result };
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
