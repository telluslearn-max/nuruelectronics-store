import "server-only";

/**
 * Phase B contract. Circle's actual TypeScript/REST SDK for wallet creation
 * and balance-reading is unconfirmed (only the CLI for *setting* spending
 * policies has been verified against real docs — see the plan doc's "Still
 * open" list). This interface is the seam: once the SDK (or a CLI-shim
 * fallback via child_process) is confirmed, implement getCircleWalletClient
 * below without touching agent-loop.ts or executor-tool.ts.
 */
export type CircleWalletClient = {
  address: string;
  chain: "polygon";
  getBalanceUsdc(): Promise<number>;
  getLimits(): Promise<{ perTxUsd: number; dailyUsd: number; weeklyUsd: number; monthlyUsd: number }>;
  /** Signs and submits a Polymarket order via the wallet's key material. */
  signAndSendPolymarketOrder(args: { tokenId: string; sizeUsd: number; side: "BUY" | "SELL" }): Promise<{ txHash: string }>;
};

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const walletAddress = process.env.CIRCLE_WALLET_ADDRESS;

export const isCircleWalletConfigured = Boolean(apiKey && entitySecret && walletAddress);

/**
 * Throws until Phase B is implemented for real. Deliberately does not return
 * a mock/fake signer — a wrong guess at the SDK shape here would be worse
 * than an explicit "not built yet," since this is the one path that would
 * eventually move real USDC.
 */
export function getCircleWalletClient(): CircleWalletClient {
  if (!isCircleWalletConfigured) {
    throw new Error(
      "Circle wallet isn't configured — CIRCLE_API_KEY/CIRCLE_ENTITY_SECRET/CIRCLE_WALLET_ADDRESS are unset. " +
        "This is expected until the owner completes Circle's mainnet/KYB signup (Phase B in the plan doc).",
    );
  }
  throw new Error(
    "Circle wallet client isn't implemented yet — the SDK shape needs confirming against real docs before this is " +
      "safe to wire up (see 'Still open before Phase A coding starts' in the plan doc).",
  );
}
