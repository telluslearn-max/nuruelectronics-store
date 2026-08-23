import "server-only";
import { CAPITAL_CIRCLE_NETWORK } from "./chain";
import { approveErc20, circleWalletAddress, isCircleWalletConfigured, transferErc20, wrapCollateral, type WalletTransferResult, type ContractExecutionResult } from "./circle-wallet-client";
import { requestBridgeDepositAddress, getBridgeDepositStatus, type BridgeTransaction } from "./polymarket-bridge";

/**
 * Closes the gap circle-wallet-client.ts's COLLATERAL_TOKEN_ADDRESS comment flags: getting from
 * "USDC landed in the wallet" (what Binance actually delivers — native USDC) to "the wallet holds
 * something Polymarket's exchange will accept as collateral" (pUSD) is a two-hop conversion, not
 * one missing function call:
 *
 *   1. native USDC  --[Polymarket's bridge API]-->  USDC.e   (bridgeNativeUsdcToUsdcE)
 *   2. USDC.e       --[CollateralOnramp.wrap()]-->  pUSD     (approveUsdcEForWrap + wrapUsdcEToPusd)
 *
 * Deliberately three separate human-triggered steps, not one chained pipeline: this moves real
 * money through two pieces of infrastructure this codebase doesn't control (Polymarket's bridge,
 * a third-party onramp contract) that have never been exercised from this wallet before. Chaining
 * them would mean either blocking a server action for however long an on-chain confirmation takes
 * (risking a serverless timeout that leaves state ambiguous) or silently retrying — both worse
 * than a human checking each step landed before triggering the next, the same philosophy every
 * other money-moving action in this codebase already follows (see circle-withdraw-actions.ts).
 */

/** Hard ceiling per bridge request, independent of wallet balance — same role as the caps on every other money-moving action here. */
export const BRIDGE_TO_USDCE_CAP_USDC = Number(process.env.COLLATERAL_BRIDGE_CAP_USDC ?? 25);
/** Hard ceiling per wrap request. */
export const WRAP_TO_COLLATERAL_CAP_USDC = Number(process.env.COLLATERAL_WRAP_CAP_USDC ?? 25);

export const isCollateralBridgeConfigured = Boolean(isCircleWalletConfigured && !CAPITAL_CIRCLE_NETWORK.isTestnet && CAPITAL_CIRCLE_NETWORK.nativeUsdcAddress);

function requireMainnetAddresses(): { nativeUsdc: string; usdcE: string; onramp: string; wallet: string } {
  if (!isCircleWalletConfigured || !circleWalletAddress) {
    throw new Error("Circle wallet isn't configured.");
  }
  const { nativeUsdcAddress, usdcEAddress, collateralOnrampAddress, isTestnet } = CAPITAL_CIRCLE_NETWORK;
  if (isTestnet || !nativeUsdcAddress || !usdcEAddress || !collateralOnrampAddress) {
    throw new Error(
      "The USDC.e bridge and pUSD wrap are only confirmed to exist on Polygon mainnet — refusing to guess at testnet addresses that have never been verified.",
    );
  }
  return { nativeUsdc: nativeUsdcAddress, usdcE: usdcEAddress, onramp: collateralOnrampAddress, wallet: circleWalletAddress };
}

export type BridgeRequestResult = { depositAddress: string; transfer: WalletTransferResult };

/**
 * Step 1: get a fresh Polymarket bridge deposit address for this wallet, then send native USDC
 * there on-chain. Completion is NOT synchronous — Polymarket's own docs describe polling
 * /status every 10-30s over what can be minutes; checkBridgeDepositStatus is the separate,
 * human-triggered way to follow up, deliberately not looped in here.
 */
export async function bridgeNativeUsdcToUsdcE(amountUsdc: number): Promise<BridgeRequestResult> {
  const { nativeUsdc, wallet } = requireMainnetAddresses();
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > BRIDGE_TO_USDCE_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${BRIDGE_TO_USDCE_CAP_USDC} per bridge request.`);
  }
  // Requested fresh right before sending, never reused — see requestBridgeDepositAddress's own comment.
  const addresses = await requestBridgeDepositAddress(wallet);
  const transfer = await transferErc20(nativeUsdc, addresses.evm, amountUsdc);
  return { depositAddress: addresses.evm, transfer };
}

/** Step 1b (check-in, not a step of its own): look up how a bridge request is progressing. */
export async function checkBridgeDepositStatus(depositAddress: string): Promise<BridgeTransaction[]> {
  if (!depositAddress) throw new Error("A deposit address is required.");
  return getBridgeDepositStatus(depositAddress);
}

/** Step 2: approve the onramp contract to pull USDC.e out of this wallet. Must land on-chain before wrapUsdcEToPusd will succeed. */
export async function approveUsdcEForWrap(amountUsdc: number): Promise<ContractExecutionResult> {
  const { usdcE, onramp } = requireMainnetAddresses();
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > WRAP_TO_COLLATERAL_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${WRAP_TO_COLLATERAL_CAP_USDC} per wrap.`);
  }
  return approveErc20(usdcE, onramp, amountUsdc);
}

/** Step 3: mint pUSD 1:1 from the now-approved USDC.e. Reverts harmlessly (gas only) if step 2 hasn't confirmed on-chain yet. */
export async function wrapUsdcEToPusd(amountUsdc: number): Promise<ContractExecutionResult> {
  const { usdcE, onramp } = requireMainnetAddresses();
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > WRAP_TO_COLLATERAL_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${WRAP_TO_COLLATERAL_CAP_USDC} per wrap.`);
  }
  return wrapCollateral(onramp, usdcE, amountUsdc);
}
