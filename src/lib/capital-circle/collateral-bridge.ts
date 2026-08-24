import "server-only";
import { CAPITAL_CIRCLE_NETWORK } from "./chain";
import {
  approveErc20,
  circleWalletAddress,
  isCircleWalletConfigured,
  transferErc20,
  wrapCollateral,
  unwrapCollateral,
  COLLATERAL_TOKEN_ADDRESS,
  type WalletTransferResult,
  type ContractExecutionResult,
} from "./circle-wallet-client";
import { requestBridgeDepositAddress, requestBridgeWithdrawAddress, getBridgeDepositStatus, type BridgeTransaction } from "./polymarket-bridge";

/**
 * Closes the gap circle-wallet-client.ts's COLLATERAL_TOKEN_ADDRESS comment flags: getting from
 * "USDC landed in the wallet" (what Binance actually delivers — native USDC) to "the wallet holds
 * something Polymarket's exchange will accept as collateral" (pUSD) is a two-hop conversion, not
 * one missing function call — and withdrawing back out is the same two hops in reverse:
 *
 *   Deposit:  native USDC --[bridge]--> USDC.e --[CollateralOnramp.wrap()]--> pUSD
 *   Withdraw: pUSD --[CollateralOfframp.unwrap()]--> USDC.e --[bridge]--> native USDC, straight to Binance
 *
 * Deliberately separate human-triggered steps, not one chained pipeline: this moves real money
 * through two pieces of infrastructure this codebase doesn't control (Polymarket's bridge, a
 * third-party onramp/offramp contract pair) that have never been exercised from this wallet
 * before. Chaining them would mean either blocking a server action for however long an on-chain
 * confirmation takes (risking a serverless timeout that leaves state ambiguous) or silently
 * retrying — both worse than a human checking each step landed before triggering the next, the
 * same philosophy every other money-moving action in this codebase already follows (see
 * circle-withdraw-actions.ts).
 *
 * The withdraw path's final leg deliberately skips ever holding native USDC in the Circle wallet
 * at all: the bridge's own recipientAddr is set directly to BINANCE_DEPOSIT_ADDRESS, so the
 * existing destination-pinning guarantee (see circle-wallet-withdraw.ts) carries straight through
 * — funds go from USDC.e in this wallet to Binance in one bridge call, never passing through an
 * intermediate native-USDC balance this app would then need a second withdrawal step to move.
 */

/** Hard ceiling per bridge request, independent of wallet balance — same role as the caps on every other money-moving action here. */
export const BRIDGE_TO_USDCE_CAP_USDC = Number(process.env.COLLATERAL_BRIDGE_CAP_USDC ?? 25);
/** Hard ceiling per wrap request. */
export const WRAP_TO_COLLATERAL_CAP_USDC = Number(process.env.COLLATERAL_WRAP_CAP_USDC ?? 25);
/** Hard ceiling per unwrap request (pUSD -> USDC.e). */
export const UNWRAP_FROM_COLLATERAL_CAP_USDC = Number(process.env.COLLATERAL_UNWRAP_CAP_USDC ?? 25);
/** Hard ceiling per bridge-withdraw request (USDC.e -> native USDC, delivered straight to Binance). */
export const BRIDGE_WITHDRAW_CAP_USDC = Number(process.env.COLLATERAL_BRIDGE_WITHDRAW_CAP_USDC ?? 25);

export const isCollateralBridgeConfigured = Boolean(isCircleWalletConfigured && !CAPITAL_CIRCLE_NETWORK.isTestnet && CAPITAL_CIRCLE_NETWORK.nativeUsdcAddress);

/**
 * Same fixed, non-caller-supplied destination the existing native-USDC withdraw path uses (see
 * circle-wallet-withdraw.ts) — read independently here rather than importing it, since that
 * module's own destinationAddress is intentionally unexported (module-private) and re-exporting
 * it just to share one constant isn't worth coupling the two withdrawal paths together.
 */
const binanceDepositAddress = process.env.BINANCE_DEPOSIT_ADDRESS;

export const isCollateralWithdrawConfigured = Boolean(isCollateralBridgeConfigured && binanceDepositAddress);

function requireMainnetAddresses(): { nativeUsdc: string; usdcE: string; onramp: string; offramp: string; pusd: string; wallet: string } {
  if (!isCircleWalletConfigured || !circleWalletAddress) {
    throw new Error("Circle wallet isn't configured.");
  }
  const { nativeUsdcAddress, usdcEAddress, collateralOnrampAddress, collateralOfframpAddress, isTestnet } = CAPITAL_CIRCLE_NETWORK;
  if (isTestnet || !nativeUsdcAddress || !usdcEAddress || !collateralOnrampAddress || !collateralOfframpAddress) {
    throw new Error(
      "The USDC.e bridge and pUSD wrap/unwrap are only confirmed to exist on Polygon mainnet — refusing to guess at testnet addresses that have never been verified.",
    );
  }
  return { nativeUsdc: nativeUsdcAddress, usdcE: usdcEAddress, onramp: collateralOnrampAddress, offramp: collateralOfframpAddress, pusd: COLLATERAL_TOKEN_ADDRESS, wallet: circleWalletAddress };
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

// ---------------------------------------------------------------------------
// Withdrawal — the same two hops as above, run in reverse: pUSD -> USDC.e -> native USDC,
// delivered straight to BINANCE_DEPOSIT_ADDRESS by the bridge's own final leg.
// ---------------------------------------------------------------------------

/** Step 1: approve the offramp contract to pull pUSD out of this wallet. Must land on-chain before unwrapPusdToUsdcE will succeed. */
export async function approvePusdForUnwrap(amountUsdc: number): Promise<ContractExecutionResult> {
  const { pusd, offramp } = requireMainnetAddresses();
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > UNWRAP_FROM_COLLATERAL_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${UNWRAP_FROM_COLLATERAL_CAP_USDC} per unwrap.`);
  }
  return approveErc20(pusd, offramp, amountUsdc);
}

/** Step 2: burn pUSD 1:1 back into USDC.e. Reverts harmlessly (gas only) if step 1 hasn't confirmed on-chain yet. */
export async function unwrapPusdToUsdcE(amountUsdc: number): Promise<ContractExecutionResult> {
  const { usdcE, offramp } = requireMainnetAddresses();
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > UNWRAP_FROM_COLLATERAL_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${UNWRAP_FROM_COLLATERAL_CAP_USDC} per unwrap.`);
  }
  return unwrapCollateral(offramp, usdcE, amountUsdc);
}

/**
 * Step 3: send USDC.e to a fresh Polymarket bridge withdraw address, with recipientAddr pinned to
 * BINANCE_DEPOSIT_ADDRESS and toTokenAddress pinned to native USDC on Polygon (chain 137, the
 * network Binance's own deposit address expects — same network binance-client.ts already uses).
 * Like bridgeNativeUsdcToUsdcE, completion is NOT synchronous — checkBridgeDepositStatus (the
 * same status lookup the deposit path uses; the bridge docs describe one shared /status/{address}
 * endpoint for both directions) is the separate, human-triggered way to follow up.
 */
export async function withdrawUsdcEToBinance(amountUsdc: number): Promise<BridgeRequestResult> {
  const { nativeUsdc, usdcE, wallet } = requireMainnetAddresses();
  if (!binanceDepositAddress) {
    throw new Error("BINANCE_DEPOSIT_ADDRESS isn't set — refusing to withdraw with nowhere trusted to send it.");
  }
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > BRIDGE_WITHDRAW_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${BRIDGE_WITHDRAW_CAP_USDC} per withdrawal.`);
  }
  // Requested fresh right before sending, never reused — see requestBridgeWithdrawAddress's own comment.
  const addresses = await requestBridgeWithdrawAddress(wallet, String(CAPITAL_CIRCLE_NETWORK.chainId), nativeUsdc, binanceDepositAddress);
  const transfer = await transferErc20(usdcE, addresses.evm, amountUsdc);
  return { depositAddress: addresses.evm, transfer };
}
