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

/** Comma-separated hostnames this app is allowed to pay via x402. Empty (default) means nothing is allowed — fail closed, same as every other guardrail this session. */
const ALLOWED_HOSTS = (process.env.X402_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** Hard ceiling on any single x402 payment — independent of whatever the resource server asks for, checked against its own stated price before any signature is produced. */
export const X402_PAYMENT_CAP_USDC = Number(process.env.X402_PAYMENT_CAP_USDC ?? 0.5);

export const isX402PaymentConfigured = Boolean(circleWalletAddress) && ALLOWED_HOSTS.length > 0;

function isHostAllowed(url: string): boolean {
  try {
    return ALLOWED_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
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
 * responds 402. Two independent guardrails run before any signature is produced, both checked
 * against the server's own stated price — never a caller-supplied amount:
 *   1. The URL's host must be on X402_ALLOWED_HOSTS (fails closed if unset).
 *   2. The price must be at or under X402_PAYMENT_CAP_USDC.
 * Every attempt is audit-logged before signing and again after the paid request resolves, mirroring
 * the Binance/Circle-withdraw guardrail pattern used elsewhere in Capital Circle.
 */
export async function payForResource(url: string, init?: RequestInit): Promise<Response> {
  if (!isHostAllowed(url)) {
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
  if (amountUsdc > X402_PAYMENT_CAP_USDC) {
    throw new Error(`Requested payment $${amountUsdc.toFixed(4)} exceeds the app-level cap of $${X402_PAYMENT_CAP_USDC} per call.`);
  }

  const host = new URL(url).hostname;
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
    summary: `Requesting x402 payment of $${amountUsdc.toFixed(4)} USDC to ${url}.`,
    metadata: { url, amountUsdc, payTo: requirement.payTo, network: requirement.network },
  });

  let signature: string;
  try {
    signature = await signTransferAuthorization(authorization, {
      name: requirement.extra.name,
      version: requirement.extra.version,
      chainId: chainIdForNetwork(requirement.network),
      verifyingContract: requirement.asset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await logAdminAction({
      action: "x402.payment.failed",
      entityType: "x402_payment",
      entityId: host,
      summary: `x402 payment signing failed for ${url}: ${message}`,
      metadata: { url, amountUsdc, error: message },
    });
    throw error;
  }

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
}
