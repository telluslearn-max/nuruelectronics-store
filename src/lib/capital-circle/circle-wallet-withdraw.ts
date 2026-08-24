import "server-only";
import { formatPrice } from "../format";
import { getBalanceUsdc, transferErc20, isCircleWalletConfigured, type WalletTransferResult } from "./circle-wallet-client";
import { CAPITAL_CIRCLE_NETWORK } from "./chain";

/**
 * Hard ceiling on any single withdrawal out of the Circle wallet — independent of the wallet's
 * own balance or any Circle-side policy, mirroring BINANCE_WITHDRAW_CAP_USDC's role on the other
 * side of this same flow.
 */
export const CIRCLE_WALLET_WITHDRAW_CAP_USDC = Number(process.env.CIRCLE_WALLET_WITHDRAW_CAP_USDC ?? 10);

/**
 * Destination is fixed via env var, never caller-supplied — same reasoning as
 * withdrawUsdcToCapitalCircleWallet() on the Binance side: no code path here can send funds
 * anywhere except this one pre-approved address, even if the caller were compromised. Expected
 * to be your Binance USDC-on-Polygon deposit address, making this the reverse leg of
 * depositFromBinance().
 */
const destinationAddress = process.env.BINANCE_DEPOSIT_ADDRESS;

export const isCircleWalletWithdrawConfigured = Boolean(isCircleWalletConfigured && destinationAddress);

/**
 * The only way NATIVE USDC leaves the Circle wallet outside of live Polymarket trading — deliberately
 * pinned to CAPITAL_CIRCLE_NETWORK.nativeUsdcAddress rather than circle-wallet-client.ts's
 * transferUsdc() (which sends whatever COLLATERAL_TOKEN_ADDRESS currently is — pUSD today).
 * Binance has no listing for pUSD at all; sending it here would silently fail to credit. This
 * button is only for native USDC sitting unconverted in the wallet — pUSD needs the separate
 * unwrap + bridge-withdraw path (collateral-bridge.ts's withdrawUsdcEToBinance) instead.
 *
 * Checks the actual on-chain balance first so a doomed request fails with a clear reason here
 * rather than as an opaque Circle API rejection.
 */
export async function withdrawUsdcToBinance(amountUsdc: number): Promise<WalletTransferResult> {
  if (!isCircleWalletConfigured) {
    throw new Error("Circle wallet isn't configured.");
  }
  if (!destinationAddress) {
    throw new Error("BINANCE_DEPOSIT_ADDRESS isn't set — refusing to withdraw with nowhere trusted to send it.");
  }
  if (CAPITAL_CIRCLE_NETWORK.isTestnet || !CAPITAL_CIRCLE_NETWORK.nativeUsdcAddress) {
    throw new Error("Native USDC's address is only confirmed on Polygon mainnet — refusing to guess at a testnet address that's never been verified.");
  }
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > CIRCLE_WALLET_WITHDRAW_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${CIRCLE_WALLET_WITHDRAW_CAP_USDC} per withdrawal.`);
  }

  // NOTE: getBalanceUsdc() reads Circle's own balance-by-symbol lookup, which circle-wallet-client.ts's
  // own comment flags as unverified for a wallet actually holding pUSD — a stale/inaccurate read here
  // would only make this check too strict or too loose, never send the wrong token, since the
  // transfer below is hardcoded to nativeUsdcAddress regardless of what this reports.
  const balance = await getBalanceUsdc();
  if (amountUsdc > balance) {
    throw new Error(`Amount exceeds the wallet's actual balance of ${formatPrice(String(balance), "USD")} USDC.`);
  }

  return transferErc20(CAPITAL_CIRCLE_NETWORK.nativeUsdcAddress, destinationAddress, amountUsdc);
}
