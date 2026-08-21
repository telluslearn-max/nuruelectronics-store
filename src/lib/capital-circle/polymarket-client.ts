import "server-only";
import { Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client-v2";
import { MARKET_FETCH_LIMIT, SEARCH_HORIZON_HOURS } from "./config";

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
  /**
   * Tradability fields. Gamma returns all of these and the original parser
   * dropped every one, which left the agent structurally unable to reason
   * about whether a market could actually be entered and exited — it saw only
   * questions and prices, so a $25 order into a $40 book looked identical to
   * one into a $40,000 book. Nullable because Gamma omits them on some markets.
   */
  volume24hr: number | null;
  liquidity: number | null;
  spread: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  slug: string | null;
  /** Resolution criteria, truncated — the fine print is where "obvious" theses go wrong. */
  description: string | null;
  /** Groups correlated markets (e.g. every outcome of one election) so the portfolio can avoid doubling up. */
  eventId: string | null;
  /** Coarse bucket from Gamma's tags — the track record is broken down by this, since the model is not equally good at all of them. */
  category: string | null;
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
/**
 * Gamma is inconsistent about numeric types — the same field arrives as a
 * JSON number on one market and a decimal string on another (volume and
 * liquidity especially). Coerce defensively and treat anything unparseable as
 * absent, since a filter that silently reads NaN as 0 would reject every
 * market whose formatting changed.
 */
export function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Gamma's own docs and this function's original design both assume `/markets` rows carry a
 * `tags` array — confirmed live that they don't: a real /markets response has no `tags` field at
 * all (it only appears on the separate /events endpoint, which this client doesn't call). So in
 * production this has always run on the slug-only fallback below, never the tags path — the tags
 * handling is kept because a market object built from a test fixture (or a future Gamma version)
 * still might carry one, but slug matching is what actually classifies every live market today.
 */
function parseCategory(raw: Record<string, unknown>): string | null {
  const tags = raw.tags;
  const labels: string[] = [];
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === "string") labels.push(tag);
      else if (tag && typeof tag === "object") {
        const label = (tag as Record<string, unknown>).label ?? (tag as Record<string, unknown>).slug;
        if (typeof label === "string") labels.push(label);
      }
    }
  }
  // Slugs are hyphen-separated and tags are space-separated, so both split into words. Word
  // boundaries are not optional here: a bare substring match reads "inflation" as the NFL and
  // files a macro market under sports, which then poisons the per-category track record.
  const haystack = ` ${`${labels.join(" ")} ${typeof raw.slug === "string" ? raw.slug.replace(/-/g, " ") : ""}`.toLowerCase().trim()} `;
  const has = (...words: string[]) => words.some((word) => new RegExp(`\\b${word}\\b`).test(haystack));

  if (has("crypto", "bitcoin", "ethereum", "btc", "eth", "solana", "sol", "xrp", "doge")) return "crypto";
  // Checked against a live top-300-by-volume snapshot (2026-08-21): esports markets (dota2, lol,
  // cs2, val) were the single largest unclassified vertical — a Dota2 match at $3.8M in 24h
  // volume outranked every crypto and traditional-sports market in the entire snapshot. Distinct
  // from "sports" rather than folded in: esports forecasting turns on patch meta and roster form,
  // not the same signals as a physical match, so a shared track record would blur both.
  if (has("esports?", "dota2?", "lol", "cs2", "csgo", "valorant", "val", "league of legends")) return "esports";
  // League abbreviations verified against real live market slugs (e.g. "epl-ars-cov-2026-08-21-ars",
  // "mlb-atl-mil-2026-08-21-total-6pt5") — "epl" was missing entirely before this, so every English
  // Premier League market (routinely $100k+ in 24h volume) silently fell through to "other"/null.
  if (
    has(
      "sports?", "nba", "nfl", "mlb", "nhl", "epl", "mls", "ufc",
      "soccer", "football", "basketball", "baseball", "hockey", "tennis", "boxing", "golf", "cricket", "rugby",
      "bundesliga", "uefa", "fifa", "la liga", "serie a", "ligue 1", "premier league", "champions league", "world cup",
    )
  )
    return "sports";
  // "geopolitics?" alone rarely matches — real slugs describe the event ("us-x-iran-ceasefire"),
  // not the abstraction. Added generic, time-durable terms rather than today's specific countries,
  // which would just go stale as the news cycle moves on. Checked live for false positives: zero
  // across the same snapshot; "ceasefire" alone already catches a real, otherwise-uncategorized market.
  if (
    has(
      "politics?", "political", "election", "president", "presidential", "senate", "congress",
      "geopolitics?", "war", "ceasefire", "sanctions?", "treaty", "nato",
    )
  )
    return "politics";
  if (has("economics?", "economy", "fed", "inflation", "cpi", "rates", "gdp", "unemployment", "recession")) return "economics";
  // Checked live: `labels.length > 0` never fires in production (tags never populate on this
  // endpoint — see this function's top comment), so this branch was silently dead and every
  // unmatched market — 71% of the top 300 by volume in the same snapshot, including large,
  // legitimate verticals this list still doesn't recognize (weather, named-person social-metric
  // markets, minor leagues) — was reported as `null` ("uncategorized") rather than the honest
  // "other". A market with a real slug always has *something* to bucket; `null` is now reserved
  // for the genuinely informationless case (no slug, no tags) rather than standing in for most of
  // the market feed.
  return labels.length > 0 || (typeof raw.slug === "string" && raw.slug.length > 0) ? "other" : null;
}

/** Exported for tests — the parse is the boundary where a Gamma format change becomes a silent trading bug. */
export function parseMarket(raw: unknown): PolymarketMarketSummary | null {
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

  const events = Array.isArray(m.events) ? m.events : [];
  const firstEvent = events[0] as Record<string, unknown> | undefined;
  const eventId = firstEvent && typeof firstEvent.id === "string" ? firstEvent.id : null;
  const rawDescription = typeof m.description === "string" ? m.description : null;

  return {
    conditionId,
    question,
    active: m.active !== false,
    closed: m.closed === true,
    tokens,
    endDate,
    volume24hr: toNum(m.volume24hr) ?? toNum(m.volumeNum) ?? toNum(m.volume),
    liquidity: toNum(m.liquidityNum) ?? toNum(m.liquidity),
    spread: toNum(m.spread),
    bestBid: toNum(m.bestBid),
    bestAsk: toNum(m.bestAsk),
    slug: typeof m.slug === "string" ? m.slug : null,
    // Resolution criteria matter but are often thousands of words; the head carries the
    // actual rule, and the rest is boilerplate that would crowd the model's context.
    description: rawDescription ? rawDescription.slice(0, 500) : null,
    eventId,
    category: parseCategory(m),
  };
}

/**
 * Gamma silently caps a single /markets response at 100 rows — confirmed live: requesting
 * `limit=250` or `limit=500` still returns exactly 100. There is no error, no truncation flag,
 * nothing to notice; a caller asking for more just quietly gets less. `offset` does paginate
 * correctly past that cap (confirmed live: offset=100 returns a distinct next page, 95/100 rows
 * not present in the first). Without this, MARKET_FETCH_LIMIT (150 by default) was never
 * actually reachable — every cycle was silently screening from at most 100 raw markets, not the
 * number its own config claimed.
 */
const GAMMA_PAGE_SIZE = 100;

/**
 * Live, real markets — no auth needed. Returns active, unclosed markets resolving within
 * `maxHoursUntilResolution` hours from now (default 24) — short-horizon by design, so a real
 * win/loss track record builds up in a day, not years. The date-range filtering happens
 * server-side via Gamma's end_date_min/end_date_max, not a client-side filter over a fixed
 * sample — otherwise the CLOB's own sampling endpoint (see parseMarket's comment) would just
 * return zero results every time.
 *
 * Ordered by 24-hour volume, descending. Without an explicit `order`, Gamma
 * returns rows in an arbitrary order and truncating to a handful meant the
 * candidate set was chosen essentially at random from the window — the single
 * cheapest quality fix available, since the most-traded markets are also the
 * ones with books deep enough to enter and exit. The default limit is
 * deliberately larger than what the model ever sees: candidate-filter.ts
 * screens this list down in code first.
 *
 * Paginates via `offset` to actually reach `limit` past Gamma's 100-row-per-request cap (see
 * GAMMA_PAGE_SIZE). Stops early the moment a page comes back short — that's Gamma saying the
 * window is exhausted, and one extra request to confirm zero-more would be pure waste.
 */
export async function listActivePolymarketMarkets(
  limit = MARKET_FETCH_LIMIT,
  maxHoursUntilResolution = SEARCH_HORIZON_HOURS,
): Promise<PolymarketMarketSummary[]> {
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + maxHoursUntilResolution * 60 * 60 * 1000);
  const raw: unknown[] = [];

  for (let offset = 0; offset < limit; offset += GAMMA_PAGE_SIZE) {
    const pageSize = Math.min(GAMMA_PAGE_SIZE, limit - offset);
    const params = new URLSearchParams({
      active: "true",
      closed: "false",
      end_date_min: now.toISOString(),
      end_date_max: horizonEnd.toISOString(),
      order: "volume24hr",
      ascending: "false",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${GAMMA_API_BASE}/markets?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Polymarket Gamma API request failed (HTTP ${response.status}).`);
    }
    const body = await response.json();
    const page = Array.isArray(body) ? body : [];
    raw.push(...page);
    if (page.length < pageSize) break;
  }

  return raw.map(parseMarket).filter((m): m is PolymarketMarketSummary => Boolean(m));
}

/**
 * Whether a specific market has closed on Polymarket — used by the settlement job, which only
 * ever calls this to answer exactly that question, never to inspect an open market's live state
 * (listActivePolymarketMarkets already covers that). `closed: "true"` is required, confirmed
 * against a real closed market: Gamma's `condition_ids` filter silently excludes closed markets
 * when the closed param is omitted entirely — it does not default to "either", it defaults to
 * effectively closed=false. Without this, settlement could never see a market that had actually
 * resolved, no matter how long it waited.
 */
export async function getPolymarketMarketByConditionId(conditionId: string): Promise<PolymarketMarketSummary | null> {
  const params = new URLSearchParams({ condition_ids: conditionId, closed: "true" });
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

export type OrderBookSummary = {
  bestBid: number | null;
  bestAsk: number | null;
  midpoint: number | null;
  spread: number | null;
  /** Resting USD on each side across the top levels — what a taker can actually fill against. */
  bidDepthUsd: number;
  askDepthUsd: number;
};

/** Top levels summed for depth. Beyond a handful, the prices are far enough away to be irrelevant to a $25 order. */
const DEPTH_LEVELS = 5;

/**
 * The live book for one outcome token — the difference between what a trade
 * is assumed to cost and what it costs. Entry pricing used to come from
 * Gamma's mid/last, so every simulated fill silently got a better price than
 * any real order could have, and the ask-side depth (whether the order would
 * move the market at all) was never consulted.
 *
 * Returns null on any failure rather than throwing: callers treat an
 * unavailable book as "price this conservatively", not as a broken cycle.
 */
export async function getOrderBookSummary(tokenId: string): Promise<OrderBookSummary | null> {
  const client = getReadClient();
  try {
    const book = await client.getOrderBook(tokenId);
    if (!book || typeof book !== "object") return null;

    const raw = book as unknown as { bids?: unknown; asks?: unknown };
    const bids = normalizeLevels(raw.bids);
    const asks = normalizeLevels(raw.asks);

    // Polymarket returns each side sorted worst-to-best; the top of book is the
    // highest bid and the lowest ask regardless of the order they arrive in.
    const bestBid = bids.length > 0 ? Math.max(...bids.map((l) => l.price)) : null;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map((l) => l.price)) : null;

    const bidDepthUsd = topLevelsDepth(bids, "desc");
    const askDepthUsd = topLevelsDepth(asks, "asc");

    const midpoint = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;
    const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;

    return { bestBid, bestAsk, midpoint, spread, bidDepthUsd, askDepthUsd };
  } catch {
    return null;
  }
}

type BookLevel = { price: number; size: number };

function normalizeLevels(raw: unknown): BookLevel[] {
  if (!Array.isArray(raw)) return [];
  const levels: BookLevel[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const price = toNum(record.price);
    const size = toNum(record.size);
    if (price != null && size != null && price > 0 && size > 0) levels.push({ price, size });
  }
  return levels;
}

/** Notional USD resting across the levels nearest the touch (price × size, since size is in shares). */
function topLevelsDepth(levels: BookLevel[], direction: "asc" | "desc"): number {
  const sorted = [...levels].sort((a, b) => (direction === "asc" ? a.price - b.price : b.price - a.price));
  return sorted.slice(0, DEPTH_LEVELS).reduce((sum, level) => sum + level.price * level.size, 0);
}

export type PriceHistoryFeatures = {
  /** Downsampled series, oldest first — enough shape to see a trend without flooding the context. */
  series: { t: number; p: number }[];
  current: number | null;
  change1h: number | null;
  change6h: number | null;
  change24h: number | null;
  /** Standard deviation of point-to-point moves — how noisy this market has been. */
  volatility: number | null;
  high24h: number | null;
  low24h: number | null;
};

const MAX_SERIES_POINTS = 50;

/**
 * Price history for a token, pre-digested into the features that actually
 * inform a short-horizon thesis (momentum, volatility, distance from the
 * day's extremes) rather than a wall of raw points for the model to eyeball.
 * Computing these in code means they're consistent and free; asking a
 * language model to derive them from a list of numbers is neither.
 */
export async function getPricesHistoryForModel(tokenId: string, hours = 24): Promise<PriceHistoryFeatures | null> {
  const client = getReadClient();
  const nowTs = Math.floor(Date.now() / 1000);
  try {
    const response = await client.getPricesHistory({
      market: tokenId,
      startTs: nowTs - hours * 3600,
      endTs: nowTs,
      fidelity: 10,
    });
    // Same wrapped-vs-bare shape handling as getPolymarketHistoricalPrice — the SDK's
    // declaration disagrees with the live endpoint, so trust neither blindly.
    const rawPoints = Array.isArray(response) ? response : (response as unknown as { history?: unknown }).history;
    if (!Array.isArray(rawPoints) || rawPoints.length === 0) return null;

    const points = rawPoints
      .map((point) => ({ t: toNum((point as Record<string, unknown>).t), p: toNum((point as Record<string, unknown>).p) }))
      .filter((point): point is { t: number; p: number } => point.t != null && point.p != null)
      .sort((a, b) => a.t - b.t);
    if (points.length === 0) return null;

    const current = points[points.length - 1].p;
    const priceAgo = (secondsAgo: number): number | null => {
      const target = nowTs - secondsAgo;
      const candidates = points.filter((point) => point.t <= target);
      return candidates.length > 0 ? candidates[candidates.length - 1].p : null;
    };
    const changeSince = (secondsAgo: number): number | null => {
      const past = priceAgo(secondsAgo);
      return past == null ? null : round4(current - past);
    };

    const deltas = points.slice(1).map((point, index) => point.p - points[index].p);
    const volatility = deltas.length > 1 ? round4(standardDeviation(deltas)) : null;
    const prices = points.map((point) => point.p);

    return {
      series: downsample(points, MAX_SERIES_POINTS),
      current,
      change1h: changeSince(3600),
      change6h: changeSince(6 * 3600),
      change24h: changeSince(24 * 3600),
      volatility,
      high24h: Math.max(...prices),
      low24h: Math.min(...prices),
    };
  } catch {
    return null;
  }
}

function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]);
  // Always keep the most recent point — it's the one the thesis is priced against.
  out[out.length - 1] = points[points.length - 1];
  return out;
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export { OrderType, Side };
