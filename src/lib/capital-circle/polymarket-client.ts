import "server-only";
import { Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client-v2";

const CLOB_HOST = "https://clob.polymarket.com";
const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

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

export type PolymarketOutcomeToken = {
  tokenId: string;
  /** e.g. "Yes" / "No", or a specific candidate/team name for multi-outcome markets. */
  outcome: string;
  /** Current price, 0-1 — the market's implied probability for this specific outcome. */
  price: number;
};

export type PolymarketMarketSummary = {
  conditionId: string;
  question: string;
  active: boolean;
  closed: boolean;
  tokens: PolymarketOutcomeToken[];
  /** When this market resolves — parsed from Polymarket's `end_date_iso`. */
  endDate: Date;
};

/**
 * Parses a Gamma API market (https://gamma-api.polymarket.com/markets) — a different shape than
 * the CLOB's own market listings, and the only Polymarket endpoint that supports filtering by
 * resolution-time range (end_date_min/end_date_max), which the CLOB's getSamplingMarkets() does
 * not — confirmed live: getSamplingMarkets()'s closest result was ~13 days out, with no way to
 * ask it for anything sooner, while Gamma correctly surfaces markets resolving in minutes (the
 * hourly crypto up/down markets). outcomes/outcomePrices/clobTokenIds are parallel arrays,
 * JSON-stringified rather than nested objects — verified against a real live response. The
 * clobTokenIds are the same global token identifiers the CLOB trading API uses, so these are safe
 * to trade against later, not just for discovery.
 */
function parseMarket(raw: unknown): PolymarketMarketSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const conditionId = typeof m.conditionId === "string" ? m.conditionId : null;
  const question = typeof m.question === "string" ? m.question : null;
  if (!conditionId || !question) return null;
  const endDateRaw = typeof m.endDate === "string" ? m.endDate : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  if (!endDate || Number.isNaN(endDate.getTime())) return null;

  const parseJsonArray = (value: unknown): string[] => {
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };
  const outcomes = parseJsonArray(m.outcomes);
  const prices = parseJsonArray(m.outcomePrices);
  const tokenIds = parseJsonArray(m.clobTokenIds);

  const tokens: PolymarketOutcomeToken[] = [];
  for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i];
    const outcome = outcomes[i];
    const price = Number(prices[i]);
    if (tokenId && outcome && Number.isFinite(price)) {
      tokens.push({ tokenId, outcome, price });
    }
  }

  return {
    conditionId,
    question,
    active: m.active !== false,
    closed: m.closed === true,
    tokens,
    endDate,
  };
}

/**
 * Live, real markets — no auth needed. Returns active, unclosed markets resolving within
 * `maxHoursUntilResolution` hours from now (default 24) — short-horizon by design, so a real
 * win/loss track record builds up in a day, not years. The date-range filtering happens
 * server-side via Gamma's end_date_min/end_date_max, not a client-side filter over a fixed
 * sample — otherwise the CLOB's own sampling endpoint (see parseMarket's comment) would just
 * return zero results every time.
 */
export async function listActivePolymarketMarkets(limit = 20, maxHoursUntilResolution = 24): Promise<PolymarketMarketSummary[]> {
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + maxHoursUntilResolution * 60 * 60 * 1000);
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    end_date_min: now.toISOString(),
    end_date_max: horizonEnd.toISOString(),
    limit: String(limit),
  });
  const response = await fetch(`${GAMMA_API_BASE}/markets?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Polymarket Gamma API request failed (HTTP ${response.status}).`);
  }
  const body = await response.json();
  const raw = Array.isArray(body) ? body : [];
  return raw.map(parseMarket).filter((m): m is PolymarketMarketSummary => Boolean(m));
}

/**
 * A single market by its condition id, resolved or not — used by the settlement job to check
 * whether an open position's market has closed yet and, if so, what each outcome's final price
 * settled at (a resolved market's winning outcome converges to 1, the losing one to 0). Unlike
 * listActivePolymarketMarkets, this deliberately has no active/closed filter — a closed market is
 * exactly the case this needs to see.
 */
export async function getPolymarketMarketByConditionId(conditionId: string): Promise<PolymarketMarketSummary | null> {
  const params = new URLSearchParams({ condition_ids: conditionId });
  const response = await fetch(`${GAMMA_API_BASE}/markets?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Polymarket Gamma API request failed (HTTP ${response.status}).`);
  }
  const body = await response.json();
  const raw = Array.isArray(body) ? body : [];
  const markets = raw.map(parseMarket).filter((m): m is PolymarketMarketSummary => Boolean(m));
  return markets[0] ?? null;
}

/**
 * Backfills entryPrice for positions recorded before that field existed — settlement.ts calls
 * this rather than leaving old positions permanently unscored. Pulls the CLOB's own price-history
 * series for the token in a window around `atDate` and returns whichever point is closest to it,
 * the same public, unauthenticated endpoint Polymarket's own charts use. `fidelity` is in minutes
 * (1 = one point per minute) — a 2-hour window at 1-minute fidelity is small and precise enough
 * for "what was the price around this exact timestamp" without pulling the whole market's history.
 * Returns null (rather than throwing) if the series is empty — some very old or very short-lived
 * markets don't retain minute-level history, and that's a normal case for the caller to fall back
 * on, not an error.
 */
export async function getPolymarketHistoricalPrice(tokenId: string, atDate: Date): Promise<number | null> {
  const client = getReadClient();
  const atTs = Math.floor(atDate.getTime() / 1000);
  const windowSeconds = 60 * 60; // 1 hour each side
  try {
    const response = await client.getPricesHistory({
      market: tokenId,
      startTs: atTs - windowSeconds,
      endTs: atTs + windowSeconds,
      fidelity: 1,
    });
    // The SDK's type declaration claims this resolves to MarketPrice[] directly, but the live
    // endpoint actually wraps it as { history: MarketPrice[] } — confirmed against a real
    // response, not just the (wrong) .d.ts. Handle both shapes rather than trust either blindly.
    const points = Array.isArray(response) ? response : (response as unknown as { history?: unknown }).history;
    if (!Array.isArray(points) || points.length === 0) return null;
    const closest = points.reduce((best, point) => (Math.abs(point.t - atTs) < Math.abs(best.t - atTs) ? point : best));
    const value = Number(closest.p);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
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
