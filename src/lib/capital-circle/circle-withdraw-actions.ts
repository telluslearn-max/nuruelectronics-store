"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdminSession } from "../admin-auth";
import { logAdminAction } from "../audit-log";
import { redirectWithError, redirectWithSuccess } from "../admin-feedback";
import { withdrawUsdcToBinance, CIRCLE_WALLET_WITHDRAW_CAP_USDC } from "./circle-wallet-withdraw";
import { WALLET_ONCHAIN_TAG } from "../reports/capital-circle-wallet";

const REPORT_PATH = "/admin/reports/capital-circle";

/**
 * The reverse leg of depositFromBinance(): pushes USDC from the Circle wallet back to Binance.
 * Destination is fixed and amount is capped inside withdrawUsdcToBinance() — this action only
 * parses input and logs the attempt/result, same as every other Capital Circle write path.
 */
export async function withdrawFromCircleWallet(formData: FormData): Promise<void> {
  await requireAdminSession();

  const amountUsdc = Number(formData.get("amountUsdc") ?? 0);
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    redirectWithError(REPORT_PATH, "Enter a positive USDC amount.");
  }
  if (amountUsdc > CIRCLE_WALLET_WITHDRAW_CAP_USDC) {
    redirectWithError(REPORT_PATH, `Amount exceeds the app-level cap of $${CIRCLE_WALLET_WITHDRAW_CAP_USDC} per withdrawal.`);
  }

  await logAdminAction({
    action: "capital-circle.wallet-withdraw.attempt",
    entityType: "capital_circle_wallet",
    entityId: "circle-wallet",
    summary: `Requesting $${amountUsdc.toFixed(2)} USDC withdrawal from the Capital Circle wallet to Binance.`,
    metadata: { amountUsdc },
  });

  try {
    const result = await withdrawUsdcToBinance(amountUsdc);
    await logAdminAction({
      action: "capital-circle.wallet-withdraw.success",
      entityType: "capital_circle_wallet",
      entityId: "circle-wallet",
      summary: `Circle wallet withdrawal submitted: $${amountUsdc.toFixed(2)} USDC, transaction id ${result.id}.`,
      metadata: { amountUsdc, circleTransactionId: result.id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await logAdminAction({
      action: "capital-circle.wallet-withdraw.failed",
      entityType: "capital_circle_wallet",
      entityId: "circle-wallet",
      summary: `Circle wallet withdrawal failed: ${message}`,
      metadata: { amountUsdc, error: message },
    });
    redirectWithError(REPORT_PATH, `Withdrawal failed: ${message}`);
  }

  revalidatePath(REPORT_PATH);
  // updateTag (not revalidateTag) — Server Action, read-your-own-writes: next load shows the
  // fresh balance rather than serving stale-while-revalidate.
  updateTag(WALLET_ONCHAIN_TAG);
  redirectWithSuccess(REPORT_PATH, `Withdrawal of $${amountUsdc.toFixed(2)} USDC submitted — check transaction status shortly.`);
}
