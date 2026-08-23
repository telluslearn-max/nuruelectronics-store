import "server-only";

/**
 * Thin client for Polymarket's public bridge API (bridge.polymarket.com) — the officially
 * documented, agent-oriented path (github.com/Polymarket/agent-skills/blob/main/bridge.md) for
 * turning an arbitrary source-chain asset into USDC.e on Polygon. No API key: the docs don't
 * mention auth, and every example request omits one.
 *
 * This is deliberately NOT the same as CollateralOnramp.wrap() (see chain.ts) — the bridge only
 * gets you to USDC.e; wrap() is the separate, final step to pUSD. collateral-bridge.ts composes
 * both, one human-triggered step at a time.
 */
const BRIDGE_BASE_URL = "https://bridge.polymarket.com";

export type BridgeDepositAddresses = {
  evm: string;
  svm?: string;
  btc?: string;
  tvm?: string;
};

/**
 * Requests a fresh deposit address for the given wallet. Deliberately not cached/reused across
 * calls — same reasoning the bridge docs give for withdrawal addresses ("do not pre-generate"):
 * request one right before sending funds, not ahead of time.
 */
export async function requestBridgeDepositAddress(walletAddress: string): Promise<BridgeDepositAddresses> {
  const response = await fetch(`${BRIDGE_BASE_URL}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: walletAddress }),
  });
  if (!response.ok) {
    throw new Error(`Polymarket bridge /deposit returned HTTP ${response.status}: ${await response.text().catch(() => "")}`);
  }
  const body = (await response.json()) as Partial<BridgeDepositAddresses>;
  if (!body.evm) throw new Error("Polymarket bridge /deposit response had no evm address.");
  return body as BridgeDepositAddresses;
}

export type BridgeTransactionStatus = "DEPOSIT_DETECTED" | "PROCESSING" | "ORIGIN_TX_CONFIRMED" | "SUBMITTED" | "COMPLETED" | "FAILED";

export type BridgeTransaction = {
  fromChainId: string;
  fromTokenAddress: string;
  fromAmountBaseUnit: string;
  toChainId: string;
  toTokenAddress: string;
  status: BridgeTransactionStatus;
  txHash?: string;
  createdTimeMs: number;
};

export const BRIDGE_TERMINAL_STATUSES: readonly BridgeTransactionStatus[] = ["COMPLETED", "FAILED"];

/** Pass the deposit address returned by requestBridgeDepositAddress — NOT the wallet address (the docs are explicit that status is keyed by the former). */
export async function getBridgeDepositStatus(depositAddress: string): Promise<BridgeTransaction[]> {
  const response = await fetch(`${BRIDGE_BASE_URL}/status/${depositAddress}`);
  if (!response.ok) {
    throw new Error(`Polymarket bridge /status returned HTTP ${response.status}: ${await response.text().catch(() => "")}`);
  }
  const body = (await response.json()) as { transactions?: BridgeTransaction[] };
  return body.transactions ?? [];
}
