import "server-only";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { CAPITAL_CIRCLE_NETWORK, COLLATERAL_DECIMALS } from "./chain";

/**
 * Testnet mode is opt-in and separate from CAPITAL_CIRCLE_LIVE: it lets Phase A prove Circle's
 * wallet API (signTypedData, balance) actually works end-to-end against the real Amoy testnet
 * wallet already created by circle-wallet-setup.mjs, without needing mainnet KYB. It must never
 * be combined with CAPITAL_CIRCLE_LIVE=true — recordPosition's Polymarket CLOB calls only work
 * against a real funded mainnet wallet.
 */
const isTestnet = CAPITAL_CIRCLE_NETWORK.isTestnet;

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

/**
 * UNVERIFIED RISK: matches on Circle's own `token.symbol === "USDC"`, not on
 * COLLATERAL_TOKEN_ADDRESS. If the wallet's real balance is now in pUSD (see that constant's
 * comment) and Circle's indexer reports it under a different symbol — or doesn't recognize it
 * at all, being a token that's only ~4 months old — this silently returns 0 for a wallet that
 * actually holds tradeable collateral. Needs checking against a live Circle API response for a
 * wallet actually holding pUSD; cannot be confirmed by reading code alone.
 */
export async function getBalanceUsdc(): Promise<number> {
  const response = await getClient().getWalletTokenBalance({ id: walletId! });
  const usdcBalance = response.data?.tokenBalances?.find((b) => b.token.symbol === "USDC");
  return usdcBalance ? Number(usdcBalance.amount) : 0;
}

export const circleWalletAddress = walletAddress ?? null;
/** Circle's own internal wallet id — env-configured, never user-editable, so the "Register a
    wallet" flow can offer it as a trusted one-click confirmation instead of asking someone to
    retype a value the server already has. */
export const circleWalletId = walletId ?? null;

/**
 * The ERC-20 the Polymarket exchange actually settles orders in on the given chain — NOT
 * necessarily USDC. Polymarket migrated their collateral from bridged USDC.e to their own pUSD
 * token on April 28, 2026 (docs.polymarket.com/concepts/pusd); a wallet holding plain USDC has
 * nothing the exchange will accept as collateral without going through Polymarket's separate
 * CollateralOnramp `wrap()` step, which nothing in this codebase calls.
 *
 * Sourced from chain.ts, which itself reads the CLOB SDK's own `getContractConfig()` — the same
 * lookup `createOrder`/`createMarketOrder` use internally to pick an exchange contract — rather
 * than a hardcoded literal, specifically so a future collateral migration doesn't require hunting
 * down every copy of the address by hand again. Chain-aware: testnet (Amoy) and mainnet (Polygon)
 * have historically been given different collateral addresses even when they happen to coincide
 * today.
 */
export const COLLATERAL_TOKEN_ADDRESS = CAPITAL_CIRCLE_NETWORK.collateralTokenAddress;

export type WalletTransferResult = { id: string };

/**
 * The only function in this file that can move funds OUT of the wallet on-chain — everything
 * else here only signs off-chain data (Polymarket orders) or reads balance. Callers are expected
 * to have already validated the destination and amount against their own guardrails (fixed
 * destination, hard cap) before calling this — this function trusts its caller completely and
 * enforces nothing itself beyond what Circle's API rejects outright.
 */
export async function transferUsdc(destinationAddress: string, amountUsdc: number): Promise<WalletTransferResult> {
  return transferErc20(COLLATERAL_TOKEN_ADDRESS, destinationAddress, amountUsdc);
}

/**
 * Same money-moving primitive as transferUsdc, generalized to an arbitrary ERC-20 — needed for
 * collateral-bridge.ts, which sends native USDC (not the collateral token) to Polymarket's bridge
 * deposit address. Same trust contract as transferUsdc: no allowlist, no cap, enforced by the
 * caller.
 */
export async function transferErc20(tokenAddress: string, destinationAddress: string, amountUsdc: number): Promise<WalletTransferResult> {
  // blockchain is deliberately omitted: Circle's SDK types forbid passing it alongside walletId
  // ("Cannot be used with walletId") — the chain is already fixed by which wallet walletId names.
  const response = await getClient().createTransaction({
    walletId: walletId!,
    tokenAddress,
    amount: [amountUsdc.toString()],
    destinationAddress,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const id = response.data?.id;
  if (!id) throw new Error("Circle createTransaction returned no transaction id.");
  return { id };
}

/**
 * Base units for an ERC-20 amount (USDC/USDC.e/pUSD are all 6 decimals — COLLATERAL_DECIMALS).
 * Circle's createTransaction takes decimal strings and converts internally, but
 * createContractExecutionTransaction has no notion of a token's decimals — a raw uint256
 * abiParameter must already be in base units. Rounds rather than truncates so a value like
 * 12.345601 (a rounding artifact one hop upstream) doesn't silently lose a whole cent.
 */
export function toBaseUnits(amountDecimal: number, decimals: number = COLLATERAL_DECIMALS): string {
  if (!Number.isFinite(amountDecimal) || amountDecimal < 0) {
    throw new Error(`toBaseUnits: amount must be a non-negative finite number, got ${amountDecimal}.`);
  }
  return Math.round(amountDecimal * 10 ** decimals).toString();
}

export type ContractExecutionResult = { id: string };

/**
 * Generic contract-execution primitive for the two calls collateral-bridge.ts needs (approve,
 * wrap) — anything beyond a plain value transfer. Like transferErc20, trusts its caller
 * completely: no validation of contractAddress or parameters happens here.
 */
async function executeContract(contractAddress: string, abiFunctionSignature: string, abiParameters: unknown[]): Promise<ContractExecutionResult> {
  const response = await getClient().createContractExecutionTransaction({
    walletId: walletId!,
    contractAddress,
    abiFunctionSignature,
    abiParameters,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const id = response.data?.id;
  if (!id) throw new Error("Circle createContractExecutionTransaction returned no transaction id.");
  return { id };
}

/**
 * Standard ERC-20 approve — the prerequisite docs.polymarket.com/concepts/pusd documents before
 * calling CollateralOnramp.wrap(): "the caller must first approve the CollateralOnramp contract
 * (not the pUSD token) to spend USDC.e." amountUsdc is decimal (e.g. 12.34), converted to base
 * units here so callers never have to think in raw integer strings.
 */
export async function approveErc20(tokenAddress: string, spenderAddress: string, amountUsdc: number): Promise<ContractExecutionResult> {
  return executeContract(tokenAddress, "approve(address,uint256)", [spenderAddress, toBaseUnits(amountUsdc)]);
}

/**
 * Calls CollateralOnramp.wrap(_asset, _to, _amount) — mints pUSD 1:1 from an already-approved
 * ERC-20 balance (USDC.e in practice; see chain.ts's usdcEAddress comment for why it's the only
 * asset confirmed to work). Reverts on-chain (costing only gas, not the principal) if the
 * approveErc20 call above hasn't landed yet — callers are expected to confirm that on an explorer
 * before calling this, not to chain the two automatically.
 */
export async function wrapCollateral(onrampAddress: string, assetAddress: string, amountUsdc: number): Promise<ContractExecutionResult> {
  return executeContract(onrampAddress, "wrap(address,address,uint256)", [assetAddress, walletAddress!, toBaseUnits(amountUsdc)]);
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
