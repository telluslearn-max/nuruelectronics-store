import "server-only";
import type { FunctionDeclaration } from "@google/genai";
import { researchPolymarketMarkets } from "./research-tool";
import { sizePosition } from "./sizing-tool";
import { recordPosition } from "./executor-tool";

const researchPolymarketMarketsDeclaration: FunctionDeclaration = {
  name: "research_polymarket_markets",
  description: "List real, live, active Polymarket prediction markets (question, condition id, outcome token ids). Never invent a market — always call this before referencing one.",
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

export const functionDeclarations: FunctionDeclaration[] = [
  researchPolymarketMarketsDeclaration,
  sizePositionDeclaration,
  recordPositionDeclaration,
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
        return { resultForModel: markets };
      } catch (error) {
        return { resultForModel: { error: error instanceof Error ? error.message : "Failed to fetch markets." } };
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

    default:
      return { resultForModel: { error: `Unknown tool "${name}".` } };
  }
}
