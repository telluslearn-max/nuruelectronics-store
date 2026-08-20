import "server-only";
import { createPublicClient, erc20Abi, formatUnits, http, HttpRequestError, TimeoutError } from "viem";
import { polygon, polygonAmoy } from "viem/chains";
import { CAPITAL_CIRCLE_NETWORK, COLLATERAL_DECIMALS } from "./chain";

/** Balance reads work on viem's public endpoint even unset — a single eth_call is well within
    public-RPC limits. The activity feed (a future chunk) is the one that actually needs this. */
export const isOnchainRpcConfigured = Boolean(process.env.POLYGON_RPC_URL);

export type OnchainErrorCode = "no-rpc-configured" | "timeout" | "rate-limited" | "bad-response" | "unknown";
export type OnchainError = { code: OnchainErrorCode; message: string };
export type OnchainResult<T> = { ok: true; value: T; blockNumber: number } | { ok: false; error: OnchainError };

export function classifyError(error: unknown): OnchainError {
  if (error instanceof TimeoutError) {
    return { code: "timeout", message: "Polygon didn't respond in time." };
  }
  if (error instanceof HttpRequestError) {
    if (error.status === 429) return { code: "rate-limited", message: "Public RPC rate limit hit — set POLYGON_RPC_URL." };
    return { code: "bad-response", message: `RPC returned HTTP ${error.status ?? "?"}.` };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { code: "unknown", message };
}

let publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!publicClient) {
    const chain = CAPITAL_CIRCLE_NETWORK.isTestnet ? polygonAmoy : polygon;
    // http() with no URL falls back to viem's chain-default public RPC — deliberately how this
    // stays usable without POLYGON_RPC_URL configured at all; see isOnchainRpcConfigured's comment.
    publicClient = createPublicClient({ chain, transport: http(process.env.POLYGON_RPC_URL, { timeout: 4000, retryCount: 1 }) });
  }
  return publicClient;
}

/**
 * Never throws — catches everything and returns the discriminated result instead. This is not a
 * style preference: every caller of these three functions renders inside a Suspense boundary with
 * no error.tsx under src/app/admin/reports/, so an unhandled rejection here takes down the entire
 * admin page, not just the balance tile that failed.
 */
async function readErc20(tokenAddress: string, holder: string, decimals: number): Promise<OnchainResult<number>> {
  try {
    const client = getPublicClient();
    const [raw, blockNumber] = await Promise.all([
      client.readContract({ address: tokenAddress as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [holder as `0x${string}`] }),
      client.getBlockNumber(),
    ]);
    return { ok: true, value: Number(formatUnits(raw, decimals)), blockNumber: Number(blockNumber) };
  } catch (error) {
    return { ok: false, error: classifyError(error) };
  }
}

/** The token Polymarket actually settles orders in — see chain.ts / circle-wallet-client.ts's COLLATERAL_TOKEN_ADDRESS comment. */
export function readCollateralBalance(holder: string): Promise<OnchainResult<number>> {
  return readErc20(CAPITAL_CIRCLE_NETWORK.collateralTokenAddress, holder, COLLATERAL_DECIMALS);
}

/** POL — needed to pay gas for a live Polymarket order. Not tracked anywhere else in this codebase today. */
export async function readNativeBalance(holder: string): Promise<OnchainResult<number>> {
  try {
    const client = getPublicClient();
    const [raw, blockNumber] = await Promise.all([client.getBalance({ address: holder as `0x${string}` }), client.getBlockNumber()]);
    return { ok: true, value: Number(formatUnits(raw, 18)), blockNumber: Number(blockNumber) };
  } catch (error) {
    return { ok: false, error: classifyError(error) };
  }
}

/** How much of the collateral token `spender` (the Polymarket exchange contract) is approved to pull from `owner`. Zero means every live order fails until an approval is granted. */
export async function readCollateralAllowance(owner: string, spender: string): Promise<OnchainResult<number>> {
  try {
    const client = getPublicClient();
    const [raw, blockNumber] = await Promise.all([
      client.readContract({
        address: CAPITAL_CIRCLE_NETWORK.collateralTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner as `0x${string}`, spender as `0x${string}`],
      }),
      client.getBlockNumber(),
    ]);
    return { ok: true, value: Number(formatUnits(raw, COLLATERAL_DECIMALS)), blockNumber: Number(blockNumber) };
  } catch (error) {
    return { ok: false, error: classifyError(error) };
  }
}
