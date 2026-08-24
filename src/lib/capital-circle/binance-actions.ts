"use server";

import { withdrawUsdcToCapitalCircleWallet, BINANCE_WITHDRAW_CAP_USDC } from "./binance-client";
import { performCapitalCircleWithdraw } from "./withdraw-action";

/**
 * The only write path this feature has: pulls USDC from Binance to the Capital Circle wallet.
 * Destination is fixed and amount is capped inside withdrawUsdcToCapitalCircleWallet — this
 * action only parses input and logs the attempt/result, same as every other Capital Circle
 * write path in this app (see performCapitalCircleWithdraw, which owns that shared scaffolding).
 */
export async function depositFromBinance(formData: FormData): Promise<void> {
  await performCapitalCircleWithdraw({
    formData,
    capUsdc: BINANCE_WITHDRAW_CAP_USDC,
    client: withdrawUsdcToCapitalCircleWallet,
    entityId: "binance",
    actionAttempt: "capital-circle.binance-deposit.attempt",
    actionSuccess: "capital-circle.binance-deposit.success",
    actionFailed: "capital-circle.binance-deposit.failed",
    successMetadataKey: "binanceWithdrawId",
    capExceededMessage: (cap) => `Amount exceeds the app-level cap of $${cap} per withdrawal.`,
    attemptSummary: (amountUsdc) =>
      `Requesting $${amountUsdc.toFixed(2)} USDC withdrawal from Binance to the Capital Circle wallet.`,
    successSummary: (amountUsdc, id) => `Binance withdrawal accepted: $${amountUsdc.toFixed(2)} USDC, id ${id}.`,
    failedSummary: (message) => `Binance withdrawal failed: ${message}`,
    failedRedirectMessage: (message) => `Binance withdrawal failed: ${message}`,
    successRedirectMessage: (amountUsdc) =>
      `Requested $${amountUsdc.toFixed(2)} USDC from Binance — check the wallet balance shortly.`,
  });
}
