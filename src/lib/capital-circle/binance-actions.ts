"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../admin-auth";
import { logAdminAction } from "../audit-log";
import { redirectWithError, redirectWithSuccess } from "../admin-feedback";
import { withdrawUsdcToCapitalCircleWallet, BINANCE_WITHDRAW_CAP_USDC } from "./binance-client";

const REPORT_PATH = "/admin/reports/capital-circle";

/**
 * The only write path this feature has: pulls USDC from Binance to the Capital Circle wallet.
 * Destination is fixed and amount is capped inside withdrawUsdcToCapitalCircleWallet — this
 * action only parses input and logs the attempt/result, same as every other Capital Circle
 * write path in this app.
 */
export async function depositFromBinance(formData: FormData): Promise<void> {
  await requireAdminSession();

  const amountUsdc = Number(formData.get("amountUsdc") ?? 0);
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    redirectWithError(REPORT_PATH, "Enter a positive USDC amount.");
  }
  if (amountUsdc > BINANCE_WITHDRAW_CAP_USDC) {
    redirectWithError(REPORT_PATH, `Amount exceeds the app-level cap of $${BINANCE_WITHDRAW_CAP_USDC} per withdrawal.`);
  }

  await logAdminAction({
    action: "capital-circle.binance-deposit.attempt",
    entityType: "capital_circle_wallet",
    entityId: "binance",
    summary: `Requesting $${amountUsdc.toFixed(2)} USDC withdrawal from Binance to the Capital Circle wallet.`,
    metadata: { amountUsdc },
  });

  try {
    const result = await withdrawUsdcToCapitalCircleWallet(amountUsdc);
    await logAdminAction({
      action: "capital-circle.binance-deposit.success",
      entityType: "capital_circle_wallet",
      entityId: "binance",
      summary: `Binance withdrawal accepted: $${amountUsdc.toFixed(2)} USDC, id ${result.id}.`,
      metadata: { amountUsdc, binanceWithdrawId: result.id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await logAdminAction({
      action: "capital-circle.binance-deposit.failed",
      entityType: "capital_circle_wallet",
      entityId: "binance",
      summary: `Binance withdrawal failed: ${message}`,
      metadata: { amountUsdc, error: message },
    });
    redirectWithError(REPORT_PATH, `Binance withdrawal failed: ${message}`);
  }

  revalidatePath(REPORT_PATH);
  redirectWithSuccess(REPORT_PATH, `Requested $${amountUsdc.toFixed(2)} USDC from Binance — check the wallet balance shortly.`);
}
