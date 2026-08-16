import "server-only";
import { listActivePolymarketMarkets, type PolymarketMarketSummary } from "./polymarket-client";

/** Live Polymarket markets, no auth needed — see polymarket-client.ts. */
export async function researchPolymarketMarkets(limit?: number): Promise<PolymarketMarketSummary[]> {
  return listActivePolymarketMarkets(limit);
}
