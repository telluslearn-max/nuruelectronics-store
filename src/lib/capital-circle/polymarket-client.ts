import "server-only";
import { Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client-v2";

const CLOB_HOST = "https://clob.polymarket.com";

/**
 * Unauthenticated (no signer) client — Polymarket's CLOB market-data
 * endpoints (getMarkets/getOrderBook/getMidpoint/etc.) are public and need
 * no wallet or API credentials. Only order placement needs the signer/creds
 * that Phase B's live executor would add. See circle-wallet-client.ts for
 * why order placement isn't wired up yet.
 */
let readClient: ClobClient | null = null;

function getReadClient(): ClobClient {
  if (!readClient) {
    readClient = new ClobClient({ host: CLOB_HOST, chain: Chain.POLYGON });
  }
  return readClient;
}

export type PolymarketMarketSummary = {
  conditionId: string;
  question: string;
  active: boolean;
  closed: boolean;
  tokenIds: string[];
};

/**
 * The CLOB client types market-list entries as `any` (raw REST pass-through)
 * — this parses defensively rather than trusting an exact shape, since it
 * hasn't been verified against a live response (Circle/Polymarket doc
 * fetches were blocked from this environment; see the plan doc).
 */
function parseMarket(raw: unknown): PolymarketMarketSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const conditionId = typeof m.condition_id === "string" ? m.condition_id : typeof m.conditionId === "string" ? m.conditionId : null;
  const question = typeof m.question === "string" ? m.question : null;
  if (!conditionId || !question) return null;
  const tokens = Array.isArray(m.tokens) ? m.tokens : [];
  const tokenIds = tokens
    .map((t) => (t && typeof t === "object" && typeof (t as Record<string, unknown>).token_id === "string" ? (t as Record<string, unknown>).token_id as string : null))
    .filter((id): id is string => Boolean(id));
  return {
    conditionId,
    question,
    active: m.active !== false,
    closed: m.closed === true,
    tokenIds,
  };
}

/** Live, real markets — no auth needed. Returns active, unclosed markets only. */
export async function listActivePolymarketMarkets(limit = 20): Promise<PolymarketMarketSummary[]> {
  const client = getReadClient();
  const page = await client.getSamplingMarkets();
  const parsed = (page.data ?? []).map(parseMarket).filter((m): m is PolymarketMarketSummary => Boolean(m));
  return parsed.filter((m) => m.active && !m.closed).slice(0, limit);
}

export async function getPolymarketMidpoint(tokenId: string): Promise<number | null> {
  const client = getReadClient();
  try {
    const result = await client.getMidpoint(tokenId);
    const mid = typeof result === "object" && result !== null ? (result as Record<string, unknown>).mid : result;
    const value = Number(mid);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export { OrderType, Side };
