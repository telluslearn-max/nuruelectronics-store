"use server";

import { withdrawUsdcToBinance, CIRCLE_WALLET_WITHDRAW_CAP_USDC } from "./circle-wallet-withdraw";
import { performCapitalCircleWithdraw } from "./withdraw-action";

/**
 * The reverse leg of depositFromBinance(): pushes USDC from the Circle wallet back to Binance.
 * Destination is fixed and amount is capped inside withdrawUsdcToBinance() — this action only
 * parses input and logs the attempt/result, same as every other Capital Circle write path (see
 * performCapitalCircleWithdraw, which owns that shared scaffolding).
 */
export async function withdrawFromCircleWallet(formData: FormData): Promise<void> {
  await performCapitalCircleWithdraw({
    formData,
    capUsdc: CIRCLE_WALLET_WITHDRAW_CAP_USDC,
    client: withdrawUsdcToBinance,
    entityId: "circle-wallet",
    actionAttempt: "capital-circle.wallet-withdraw.attempt",
    actionSuccess: "capital-circle.wallet-withdraw.success",
    actionFailed: "capital-circle.wallet-withdraw.failed",
    successMetadataKey: "circleTransactionId",
    capExceededMessage: (cap) => `Amount exceeds the app-level cap of $${cap} per withdrawal.`,
    attemptSummary: (amountUsdc) =>
      `Requesting $${amountUsdc.toFixed(2)} USDC withdrawal from the Capital Circle wallet to Binance.`,
    successSummary: (amountUsdc, id) =>
      `Circle wallet withdrawal submitted: $${amountUsdc.toFixed(2)} USDC, transaction id ${id}.`,
    failedSummary: (message) => `Circle wallet withdrawal failed: ${message}`,
    failedRedirectMessage: (message) => `Withdrawal failed: ${message}`,
    successRedirectMessage: (amountUsdc) =>
      `Withdrawal of $${amountUsdc.toFixed(2)} USDC submitted — check transaction status shortly.`,
  });
}
