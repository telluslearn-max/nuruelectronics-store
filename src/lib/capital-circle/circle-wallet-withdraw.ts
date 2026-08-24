import "server-only";
import { formatPrice } from "../format";
import { getBalanceUsdc, transferUsdc, isCircleWalletConfigured, type WalletTransferResult } from "./circle-wallet-client";

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
 * The only way funds leave the Circle wallet outside of live Polymarket trading. Checks the
 * actual on-chain balance first so a doomed request fails with a clear reason here rather than
 * as an opaque Circle API rejection.
 */
export async function withdrawUsdcToBinance(amountUsdc: number): Promise<WalletTransferResult> {
  if (!isCircleWalletConfigured) {
    throw new Error("Circle wallet isn't configured.");
  }
  if (!destinationAddress) {
    throw new Error("BINANCE_DEPOSIT_ADDRESS isn't set — refusing to withdraw with nowhere trusted to send it.");
  }
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (amountUsdc > CIRCLE_WALLET_WITHDRAW_CAP_USDC) {
    throw new Error(`Amount exceeds the app-level cap of $${CIRCLE_WALLET_WITHDRAW_CAP_USDC} per withdrawal.`);
  }

  const balance = await getBalanceUsdc();
  if (amountUsdc > balance) {
    throw new Error(`Amount exceeds the wallet's actual balance of ${formatPrice(String(balance), "USD")} USDC.`);
  }

  return transferUsdc(destinationAddress, amountUsdc);
}
