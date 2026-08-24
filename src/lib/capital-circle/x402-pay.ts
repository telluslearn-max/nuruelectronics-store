import "server-only";
import { randomBytes } from "node:crypto";
import { signTransferAuthorization, circleWalletAddress } from "./circle-wallet-client";
import { logAdminAction } from "../audit-log";

/**
 * x402 protocol types, verified verbatim against x402-foundation/x402's canonical TypeScript
 * source (core/src/types/payments.ts) — not guessed. Targets protocol v1 (JSON 402 body,
 * X-PAYMENT header), matching Circle's own reference integration
 * (circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402) and the CLI's
 * `circle services pay`.
 */
type PaymentRequirements = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name?: string; version?: string; [key: string]: unknown };
};

type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: { url: string; description?: string; [key: string]: unknown };
  accepts: PaymentRequirements[];
};

/** Legacy v1 plain network name -> EVM chain id, per x402-foundation/x402's own EVM_NETWORK_CHAIN_ID_MAP. Only the networks this app could plausibly pay on are listed; add more only once actually needed. */
const CHAIN_ID_BY_NETWORK: Record<string, number> = {
  polygon: 137,
  base: 8453,
  ethereum: 1,
  avalanche: 43114,
};

const USDC_DECIMALS = 6;

/**
 * One allowlisted host: which category it was approved under, and (optionally) the payee address
 * an operator trusts it to always name in its own 402 response.
 */
export type AllowlistEntry = {
  host: string;
  category: string;
  pinnedPayTo: string | null;
};

/**
 * Parses X402_ALLOWED_HOSTS. Each comma-separated entry is `category:host` or
 * `category:host=0xAddress` (e.g. `news:api.example.com`, `sports-odds:odds.example.com=0xabc...`).
 *
 * Every host is approved *for a category*, not just approved outright — there is no dynamic
 * marketplace discovery wired in yet (Circle's own service-discovery is CLI-only today, with no
 * public REST API, so it can't be called from this serverless route at all; see the comment on
 * discoverableCategories below for what this is laying groundwork for). Until then, every host
 * still has to be explicitly listed by an operator — categorizing them doesn't loosen that, it
 * organizes it: the model is told which categories exist and what each host under one is for,
 * and different categories can carry different price ceilings (see CATEGORY_CAPS_USDC) instead of
 * one flat cap sized for whichever category is most expensive.
 *
 * Pure and exported specifically so this parsing — the part a malformed env var could get wrong
 * silently — is unit-tested rather than only ever exercised by a real payment attempt.
 */
export function parseAllowlist(raw: string): AllowlistEntry[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry): AllowlistEntry[] => {
      const colonIndex = entry.indexOf(":");
      if (colonIndex <= 0) {
        console.error(`[x402] ignoring malformed X402_ALLOWED_HOSTS entry (expected "category:host", got "${entry}").`);
        return [];
      }
      const category = entry.slice(0, colonIndex).trim().toLowerCase();
      const hostPart = entry.slice(colonIndex + 1).trim();
      const [host, address] = hostPart.split("=");
      if (!host) return [];
      return [{ host: host.trim().toLowerCase(), category, pinnedPayTo: address ? address.trim().toLowerCase() : null }];
    });
}

/**
 * Per-category price ceilings, parsed from X402_CATEGORY_CAPS_USDC (e.g. `news:0.05,sports-odds:0.75`).
 * A category with no entry here falls back to the flat X402_PAYMENT_CAP_USDC — same reasoning as
 * parseAllowlist for why this is a pure, separately-tested function.
 */
export function parseCategoryCaps(raw: string): Map<string, number> {
  const caps = new Map<string, number>();
  for (const entry of raw.split(",").map((e) => e.trim()).filter(Boolean)) {
    const [category, amount] = entry.split(":");
    const value = Number(amount);
    if (!category || !Number.isFinite(value) || value <= 0) {
      console.error(`[x402] ignoring malformed X402_CATEGORY_CAPS_USDC entry (expected "category:amount", got "${entry}").`);
      continue;
    }
    caps.set(category.trim().toLowerCase(), value);
  }
  return caps;
}

const ALLOWLIST = parseAllowlist(process.env.X402_ALLOWED_HOSTS ?? "");
const ALLOWLIST_BY_HOST = new Map(ALLOWLIST.map((entry) => [entry.host, entry]));
const CATEGORY_CAPS_USDC = parseCategoryCaps(process.env.X402_CATEGORY_CAPS_USDC ?? "");

/** Hard ceiling on any single x402 payment when its category has no cap of its own — checked against the resource server's own stated price before any signature is produced. */
export const X402_PAYMENT_CAP_USDC = Number(process.env.X402_PAYMENT_CAP_USDC ?? 0.5);

/** The distinct categories currently approved — what the model's tool description enumerates, and (once discovery is wired in) what a discovered service's own category will be checked against. */
export function approvedCategories(): string[] {
  return [...new Set(ALLOWLIST.map((entry) => entry.category))].sort();
}

/** The per-call price ceiling for a category — its own cap if one is configured, else the flat default. */
export function capForCategory(category: string): number {
  return CATEGORY_CAPS_USDC.get(category.toLowerCase()) ?? X402_PAYMENT_CAP_USDC;
}

export const isX402PaymentConfigured = Boolean(circleWalletAddress) && ALLOWLIST.length > 0;

function allowlistEntryForUrl(url: string): AllowlistEntry | null {
  try {
    return ALLOWLIST_BY_HOST.get(new URL(url).hostname.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

function chainIdForNetwork(network: string): number {
  const chainId = CHAIN_ID_BY_NETWORK[network.toLowerCase()];
  if (!chainId) {
    throw new Error(`Unsupported x402 network "${network}" — add it to CHAIN_ID_BY_NETWORK in x402-pay.ts if this is expected.`);
  }
  return chainId;
}

function randomNonce(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

function base64EncodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

/**
 * Fetches an x402-protected resource, paying for it from the Capital Circle wallet if the server
 * responds 402. Guardrails run before any signature is produced, checked against the server's own
 * stated requirements — never a caller-supplied amount:
 *   1. The URL's host must be on X402_ALLOWED_HOSTS, which also names its approved category (fails closed if unset).
 *   2. The price must be at or under that category's cap (capForCategory — its own X402_CATEGORY_CAPS_USDC entry, or the flat X402_PAYMENT_CAP_USDC default).
 *   3. If that host has a pinned payTo configured, the requirement's payTo must match it.
 * Unlike the Binance/Circle-withdraw guardrails elsewhere in Capital Circle, this is NOT
 * destination-pinning by default — the resource server always names its own payTo in the 402
 * response, and paying whoever it names is the protocol working as intended, not a gap. Guardrail
 * #3 above is the opt-in way to get a pinning guarantee for a specific trusted host.
 * Every attempt is audit-logged before signing and again after the paid request resolves.
 */
export async function payForResource(url: string, init?: RequestInit): Promise<Response> {
  const entry = allowlistEntryForUrl(url);
  if (!entry) {
    throw new Error(`Host for ${url} is not on X402_ALLOWED_HOSTS — refusing to pay.`);
  }
  if (!circleWalletAddress) {
    throw new Error("Circle wallet isn't configured — nothing to pay with.");
  }

  const initialResponse = await fetch(url, init);
  if (initialResponse.status !== 402) {
    return initialResponse;
  }

  const paymentRequired = (await initialResponse.json()) as PaymentRequired;
  const requirement = paymentRequired.accepts?.[0];
  if (!requirement) {
    throw new Error("402 response had no payment requirements in `accepts`.");
  }
  if (!requirement.extra?.name || !requirement.extra?.version) {
    throw new Error("Payment requirements are missing extra.name/extra.version, needed for the EIP-712 domain.");
  }

  const amountUsdc = Number(requirement.amount) / 10 ** USDC_DECIMALS;
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error(`Could not parse a positive amount from payment requirements: "${requirement.amount}".`);
  }
  const cap = capForCategory(entry.category);
  if (amountUsdc > cap) {
    throw new Error(`Requested payment $${amountUsdc.toFixed(4)} exceeds the $${cap} per-call cap for the "${entry.category}" category.`);
  }

  const host = new URL(url).hostname;
  if (entry.pinnedPayTo && requirement.payTo.toLowerCase() !== entry.pinnedPayTo) {
    throw new Error(`Payment requirements named payTo ${requirement.payTo}, which doesn't match the pinned address configured for ${host}.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    to: requirement.payTo,
    value: requirement.amount,
    validAfter: "0",
    validBefore: (now + requirement.maxTimeoutSeconds).toString(),
    nonce: randomNonce(),
  };

  await logAdminAction({
    action: "x402.payment.attempt",
    entityType: "x402_payment",
    entityId: host,
    summary: `Requesting x402 payment of $${amountUsdc.toFixed(4)} USDC to ${url} (category: ${entry.category}).`,
    metadata: { url, amountUsdc, payTo: requirement.payTo, network: requirement.network, category: entry.category },
  });

  // Signing and the paid request share one try/catch: a network-level throw from the paid fetch
  // is just as much a "payment attempt fell through" as a signing error, and both need the same
  // logged "failed" outcome — otherwise a fetch throw here would escape past the "attempt" log
  // already written above with no matching success/failed entry ever recorded.
  try {
    const signature = await signTransferAuthorization(authorization, {
      name: requirement.extra.name,
      version: requirement.extra.version,
      chainId: chainIdForNetwork(requirement.network),
      verifyingContract: requirement.asset,
    });

    const paymentPayload = {
      x402Version: paymentRequired.x402Version ?? 1,
      accepted: requirement,
      payload: { authorization: { from: circleWalletAddress, ...authorization }, signature },
    };

    const paidResponse = await fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), "X-PAYMENT": base64EncodeJson(paymentPayload) },
    });

    await logAdminAction({
      action: paidResponse.ok ? "x402.payment.success" : "x402.payment.failed",
      entityType: "x402_payment",
      entityId: host,
      summary: paidResponse.ok
        ? `x402 payment of $${amountUsdc.toFixed(4)} USDC to ${url} succeeded (HTTP ${paidResponse.status}).`
        : `x402 payment of $${amountUsdc.toFixed(4)} USDC to ${url} was rejected (HTTP ${paidResponse.status}).`,
      metadata: { url, amountUsdc, status: paidResponse.status },
    });

    return paidResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await logAdminAction({
      action: "x402.payment.failed",
      entityType: "x402_payment",
      entityId: host,
      summary: `x402 payment to ${url} failed: ${message}`,
      metadata: { url, amountUsdc, error: message },
    });
    throw error;
  }
}
