import "server-only";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
/** Circle's own internal wallet id — required by their SDK for balance/signing calls, distinct from the on-chain address. */
const walletId = process.env.CIRCLE_WALLET_ID;
const walletAddress = process.env.CIRCLE_WALLET_ADDRESS;

export const isCircleWalletConfigured = Boolean(apiKey && entitySecret && walletId && walletAddress);

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
 * Polymarket-specific, but the resulting signature has not been tested
 * against a live wallet yet (no reachable Circle/Polymarket API from this
 * sandbox) — verify against a real signature before trusting it with funds.
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
