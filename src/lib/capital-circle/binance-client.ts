import "server-only";
import { createHmac } from "node:crypto";

/**
 * Optional relay for Binance's own geo-blocking: Binance returns HTTP 451 for API requests from a
 * "Restricted Location" (the US among them), and this app's Vercel deployment runs in iad1
 * (Washington D.C.) — Hobby plan only supports one project-wide function region, so there's no way
 * to move just these calls elsewhere without a relay. See services/binance-relay/README.md for the
 * full story. Leaving BINANCE_RELAY_URL unset falls back to calling Binance directly, unchanged
 * from before this existed.
 *
 * The relay never sees BINANCE_API_SECRET — signing still happens here, exactly as it did before
 * the relay existed. It only forwards an already-signed request, so BINANCE_RELAY_SECRET (a
 * separate, unrelated credential gating the relay itself) is the only new thing that needs adding
 * to every signed call.
 */
const relayUrl = process.env.BINANCE_RELAY_URL || null;
const relaySecret = process.env.BINANCE_RELAY_SECRET || null;
if (relayUrl && !relaySecret) {
  throw new Error("BINANCE_RELAY_URL is set but BINANCE_RELAY_SECRET isn't — every relayed call would fail its own auth check.");
}

const BINANCE_API_BASE = relayUrl ?? "https://api.binance.com";

function binanceHeaders(apiKeyValue: string): HeadersInit {
  return relaySecret ? { "X-MBX-APIKEY": apiKeyValue, "X-Relay-Secret": relaySecret } : { "X-MBX-APIKEY": apiKeyValue };
}

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_API_SECRET;

export const isBinanceConfigured = Boolean(apiKey && apiSecret);

/**
 * Hard ceiling on any single withdrawal this app will ever request — independent of whatever
 * limit exists on the Binance API key itself, so a bug or a compromised key can't move more than
 * this in one call regardless of Binance-side config.
 */
export const BINANCE_WITHDRAW_CAP_USDC = Number(process.env.BINANCE_WITHDRAW_CAP_USDC ?? 10);

/**
 * Optional override for the network code Binance expects on a USDC withdrawal. Per Binance's own
 * docs (developers.binance.com/docs/wallet/capital/withdraw), there is no fixed/documented network
 * code per chain — it's coin-specific and must come from GET /sapi/v1/capital/config/getall's
 * networkList. Leave unset to auto-resolve the Polygon entry from that list at request time
 * (resolveUsdcPolygonNetwork below); only set this to skip that lookup.
 */
export const BINANCE_WITHDRAW_NETWORK = process.env.BINANCE_WITHDRAW_NETWORK || null;

function sign(query: string): string {
  return createHmac("sha256", apiSecret!).update(query).digest("hex");
}

function signedGet(path: string): Promise<Response> {
  const params = new URLSearchParams({ timestamp: Date.now().toString() });
  params.set("signature", sign(params.toString()));
  return fetch(`${BINANCE_API_BASE}${path}?${params.toString()}`, {
    headers: binanceHeaders(apiKey!),
  });
}

type BinanceNetworkEntry = {
  network: string;
  name: string;
  isDefault: boolean;
  withdrawEnable: boolean;
};

/**
 * Resolves the real Binance network code for USDC-on-Polygon by asking Binance directly, rather
 * than trusting a hardcoded guess — this is exactly the mistake Binance's own withdraw docs warn
 * against ("you can get network ... in networkList of GET /sapi/v1/capital/config/getall").
 * Matches on the human-readable `name` field containing "polygon", since the `network` code
 * itself isn't guaranteed to literally say "polygon".
 */
async function resolveUsdcPolygonNetwork(): Promise<string> {
  const response = await signedGet("/sapi/v1/capital/config/getall");
  const body = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(body)) {
    throw new Error(`Couldn't fetch Binance's coin config to resolve the Polygon network code (HTTP ${response.status}).`);
  }
  const usdc = body.find((c: { coin?: string }) => c.coin === "USDC");
  if (!usdc) {
    throw new Error("USDC isn't listed in this Binance account's coin config — is it enabled?");
  }
  const networkList: BinanceNetworkEntry[] = usdc.networkList ?? [];
  const polygonMatches = networkList.filter((n) => n.name?.toLowerCase().includes("polygon"));
  // Prefer the entry Binance itself flags as default for this coin — some coins list more than
  // one polygon-named network (e.g. a legacy bridged variant alongside the current one), and
  // picking the first name match rather than the default one has silently withdrawn on the
  // wrong network before.
  const polygon = polygonMatches.find((n) => n.isDefault) ?? polygonMatches[0];
  if (!polygon) {
    throw new Error(
      `No Polygon network found in USDC's networkList — available: ${networkList.map((n) => n.name).join(", ") || "none"}.`,
    );
  }
  if (!polygon.withdrawEnable) {
    throw new Error(`USDC withdrawals on Polygon (${polygon.network}) are disabled on this Binance account right now.`);
  }
  return polygon.network;
}

export type BinanceWithdrawResult = { id: string };

/**
 * The only Binance call this app makes that moves funds. Destination is never caller-supplied —
 * always CIRCLE_WALLET_ADDRESS, the same address the rest of Capital Circle already trusts — so no
 * code path here can send Binance funds anywhere else, even if the caller were compromised. Amount
 * is hard-capped at BINANCE_WITHDRAW_CAP_USDC regardless of what the Binance API key itself
 * permits. Pair this with an address-whitelisted, IP-restricted API key on Binance's side — this
 * cap is a second, independent layer, not a substitute for that.
 */
export async function withdrawUsdcToCapitalCircleWallet(amountUsdc: number): Promise<BinanceWithdrawResult> {
  if (!isBinanceConfigured) {
    throw new Error("Binance isn't configured — set BINANCE_API_KEY/BINANCE_API_SECRET.");
  }
  const address = process.env.CIRCLE_WALLET_ADDRESS;
  if (!address) {
    throw new Error("CIRCLE_WALLET_ADDRESS isn't set — refusing to withdraw with nowhere trusted to send it.");
  }
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > BINANCE_WITHDRAW_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${BINANCE_WITHDRAW_CAP_USDC} per withdrawal.`);
  }

  const network = BINANCE_WITHDRAW_NETWORK ?? (await resolveUsdcPolygonNetwork());

  const params = new URLSearchParams({
    coin: "USDC",
    network,
    address,
    amount: amountUsdc.toString(),
    timestamp: Date.now().toString(),
  });
  params.set("signature", sign(params.toString()));

  const response = await fetch(`${BINANCE_API_BASE}/sapi/v1/capital/withdraw/apply?${params.toString()}`, {
    method: "POST",
    headers: binanceHeaders(apiKey!),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.msg || `Binance withdrawal request failed (HTTP ${response.status}).`);
  }
  return { id: body.id };
}
