import "server-only";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

/**
 * Testnet mode is opt-in and separate from CAPITAL_CIRCLE_LIVE: it lets Phase A prove Circle's
 * wallet API (signTypedData, balance) actually works end-to-end against the real Amoy testnet
 * wallet already created by circle-wallet-setup.mjs, without needing mainnet KYB. It must never
 * be combined with CAPITAL_CIRCLE_LIVE=true — recordPosition's Polymarket CLOB calls only work
 * against a real funded mainnet wallet.
 */
const isTestnet = process.env.CAPITAL_CIRCLE_WALLET_NETWORK === "testnet";

const apiKey = isTestnet ? process.env.CIRCLE_TESTNET_API_KEY : process.env.CIRCLE_API_KEY;
const entitySecret = isTestnet ? process.env.CIRCLE_TESTNET_ENTITY_SECRET : process.env.CIRCLE_ENTITY_SECRET;
/** Circle's own internal wallet id — required by their SDK for balance/signing calls, distinct from the on-chain address. */
const walletId = isTestnet ? process.env.CIRCLE_TESTNET_WALLET_ID : process.env.CIRCLE_WALLET_ID;
const walletAddress = isTestnet ? process.env.CIRCLE_TESTNET_WALLET_ADDRESS : process.env.CIRCLE_WALLET_ADDRESS;

export const isCircleWalletConfigured = Boolean(apiKey && entitySecret && walletId && walletAddress);
export const isCircleWalletTestnet = isTestnet;

let client: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;

function getClient() {
  if (!isCircleWalletConfigured) {
    throw new Error(
      "Circle wallet isn't configured — CIRCLE_API_KEY/CIRCLE_ENTITY_SECRET/CIRCLE_WALLET_ID/CIRCLE_WALLET_ADDRESS " +
        "are unset. Run scripts/circle-wallet-setup.mjs locally to provision a wallet first.",
    );
  }
  if (!client) {
    client = initiateDeveloperControlledWalletsClient({ apiKey: apiKey!, entitySecret: entitySecret! });
  }
  return client;
}

/**
 * Standard EIP-712 domain field types (the same handful MetaMask's
 * eth_signTypedData_v4 and ethers' _TypedDataEncoder recognize) — needed
 * because Circle's signTypedData wants the *complete* typed-data JSON
 * (types including EIP712Domain, domain, primaryType, message) as one
 * string, while Polymarket's signer only hands us domain/types/value
 * separately. This mapping is standard EIP-712, not Circle- or
 * Polymarket-specific. Verified against the real testnet wallet — see
 * scripts/verify-circle-testnet-wallet.ts — which confirms a signature
 * produced this way recovers to the wallet's own address via viem's
 * verifyTypedData, independent of Circle's own SDK.
 */
const DOMAIN_FIELD_TYPES: Record<string, string> = {
  name: "string",
  version: "string",
  chainId: "uint256",
  verifyingContract: "address",
  salt: "bytes32",
};

function buildCircleTypedDataJson(
  domain: Record<string, unknown>,
  types: Record<string, Array<{ name: string; type: string }>>,
  message: Record<string, unknown>,
): string {
  const eip712Domain = Object.keys(domain)
    .filter((key) => key in DOMAIN_FIELD_TYPES)
    .map((name) => ({ name, type: DOMAIN_FIELD_TYPES[name] }));
  const primaryType = Object.keys(types)[0];
  return JSON.stringify({
    types: { EIP712Domain: eip712Domain, ...types },
    domain,
    primaryType,
    message,
  });
}

/**
 * Structurally matches @polymarket/clob-client-v2's `EthersSigner` (part of
 * its `ClobSigner` union) — not imported by name since the package doesn't
 * re-export that type, but TypeScript accepts this by shape.
 */
export type PolymarketCompatibleSigner = {
  _signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>,
  ): Promise<string>;
  getAddress(): Promise<string>;
};

export function getClobSigner(): PolymarketCompatibleSigner {
  return {
    async _signTypedData(domain, types, value) {
      const response = await getClient().signTypedData({
        walletId: walletId!,
        data: buildCircleTypedDataJson(domain, types, value),
      });
      const signature = response.data?.signature;
      if (!signature) throw new Error("Circle signTypedData returned no signature.");
      return signature;
    },
    async getAddress() {
      return walletAddress!;
    },
  };
}

export async function getBalanceUsdc(): Promise<number> {
  const response = await getClient().getWalletTokenBalance({ id: walletId! });
  const usdcBalance = response.data?.tokenBalances?.find((b) => b.token.symbol === "USDC");
  return usdcBalance ? Number(usdcBalance.amount) : 0;
}

export const circleWalletAddress = walletAddress ?? null;

/** USDC's contract address on Polygon mainnet — from `circle contract address usdc --chain MATIC`, same constant used by wallet-qr.ts. */
export const USDC_POLYGON_CONTRACT = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

export type WalletTransferResult = { id: string };

/**
 * The only function in this file that can move funds OUT of the wallet on-chain — everything
 * else here only signs off-chain data (Polymarket orders) or reads balance. Callers are expected
 * to have already validated the destination and amount against their own guardrails (fixed
 * destination, hard cap) before calling this — this function trusts its caller completely and
 * enforces nothing itself beyond what Circle's API rejects outright.
 */
export async function transferUsdc(destinationAddress: string, amountUsdc: number): Promise<WalletTransferResult> {
  // blockchain is deliberately omitted: Circle's SDK types forbid passing it alongside walletId
  // ("Cannot be used with walletId") — the chain is already fixed by which wallet walletId names.
  const response = await getClient().createTransaction({
    walletId: walletId!,
    tokenAddress: USDC_POLYGON_CONTRACT,
    amount: [amountUsdc.toString()],
    destinationAddress,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const id = response.data?.id;
  if (!id) throw new Error("Circle createTransaction returned no transaction id.");
  return { id };
}

/**
 * EIP-3009 TransferWithAuthorization types — the exact gasless-USDC-transfer signature the x402
 * payment protocol's "exact" EVM scheme (and EIP-3009-compatible tokens generally) use. Verified
 * verbatim against x402-foundation/x402's canonical source
 * (mechanisms/evm/src/exact/client/eip3009.ts and constants.ts authorizationTypes), not guessed.
 */
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export type Eip3009Authorization = {
  to: string;
  /** Smallest-unit decimal string (e.g. USDC's 6-decimal amount) — kept as a string throughout, never a bigint, since Circle's signTypedData takes the complete typed-data spec as one JSON string and JSON has no bigint type. */
  value: string;
  validAfter: string;
  validBefore: string;
  /** 0x-prefixed 32-byte hex. */
  nonce: string;
};

/**
 * Signs an EIP-3009 TransferWithAuthorization from this wallet — same signing primitive as
 * getClobSigner(), different message schema. Like transferUsdc(), this trusts its caller
 * completely: no allowlist, no cap, no destination validation happens here. Callers (x402-pay.ts)
 * are expected to have already validated everything before calling this.
 */
export async function signTransferAuthorization(
  authorization: Eip3009Authorization,
  domain: { name: string; version: string; chainId: number; verifyingContract: string },
): Promise<`0x${string}`> {
  const message = {
    from: walletAddress!,
    to: authorization.to,
    value: authorization.value,
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
    nonce: authorization.nonce,
  };
  const response = await getClient().signTypedData({
    walletId: walletId!,
    data: buildCircleTypedDataJson(domain, TRANSFER_WITH_AUTHORIZATION_TYPES, message),
  });
  const signature = response.data?.signature;
  if (!signature) throw new Error("Circle signTypedData returned no signature.");
  return signature as `0x${string}`;
}
