"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdminSession } from "../admin-auth";
import { logAdminAction } from "../audit-log";
import { redirectWithError, redirectWithSuccess } from "../admin-feedback";
import { bridgeNativeUsdcToUsdcE, checkBridgeDepositStatus, approveUsdcEForWrap, wrapUsdcEToPusd, BRIDGE_TO_USDCE_CAP_USDC, WRAP_TO_COLLATERAL_CAP_USDC } from "./collateral-bridge";
import { WALLET_ONCHAIN_TAG } from "../reports/capital-circle-wallet";

const REPORT_PATH = "/admin/reports/capital-circle";

function parsePositiveAmount(formData: FormData, capUsd: number): number {
  const amountUsdc = Number(formData.get("amountUsdc") ?? 0);
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    redirectWithError(REPORT_PATH, "Enter a positive USDC amount.");
  }
  if (amountUsdc > capUsd) {
    redirectWithError(REPORT_PATH, `Amount exceeds the app-level cap of $${capUsd}.`);
  }
  return amountUsdc;
}

/** Step 1: send native USDC already sitting in the wallet to a fresh Polymarket bridge address, to come back as USDC.e. */
export async function bridgeToUsdcE(formData: FormData): Promise<void> {
  await requireAdminSession();
  const amountUsdc = parsePositiveAmount(formData, BRIDGE_TO_USDCE_CAP_USDC);

  await logAdminAction({
    action: "capital-circle.bridge-to-usdce.attempt",
    entityType: "capital_circle_wallet",
    entityId: "collateral-bridge",
    summary: `Requesting a Polymarket bridge deposit address to convert $${amountUsdc.toFixed(2)} native USDC to USDC.e.`,
    metadata: { amountUsdc },
  });

  try {
    const result = await bridgeNativeUsdcToUsdcE(amountUsdc);
    await logAdminAction({
      action: "capital-circle.bridge-to-usdce.success",
      entityType: "capital_circle_wallet",
      entityId: "collateral-bridge",
      summary: `Sent $${amountUsdc.toFixed(2)} USDC to bridge deposit address ${result.depositAddress} (Circle tx ${result.transfer.id}).`,
      metadata: { amountUsdc, depositAddress: result.depositAddress, circleTransactionId: result.transfer.id },
    });
    revalidatePath(REPORT_PATH);
    updateTag(WALLET_ONCHAIN_TAG);
    redirectWithSuccess(
      REPORT_PATH,
      `Sent $${amountUsdc.toFixed(2)} USDC to the bridge. Deposit address: ${result.depositAddress} — save this and use "Check bridge status" below; it can take a few minutes to complete.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await logAdminAction({
      action: "capital-circle.bridge-to-usdce.failed",
      entityType: "capital_circle_wallet",
      entityId: "collateral-bridge",
      summary: `Bridge-to-USDC.e failed: ${message}`,
      metadata: { amountUsdc, error: message },
    });
    redirectWithError(REPORT_PATH, `Bridge request failed: ${message}`);
  }
}

/** Step 1b: look up how a previously-requested bridge deposit is progressing. */
export async function checkBridgeStatus(formData: FormData): Promise<void> {
  await requireAdminSession();
  const depositAddress = String(formData.get("depositAddress") ?? "").trim();
  if (!depositAddress) {
    redirectWithError(REPORT_PATH, "Enter the deposit address from a previous bridge request.");
  }

  try {
    const transactions = await checkBridgeDepositStatus(depositAddress);
    if (transactions.length === 0) {
      redirectWithSuccess(REPORT_PATH, `No deposits detected yet at ${depositAddress} — the source-chain transfer may still be confirming.`);
    }
    const latest = transactions[transactions.length - 1];
    redirectWithSuccess(REPORT_PATH, `Bridge status for ${depositAddress}: ${latest.status}${latest.txHash ? ` (tx ${latest.txHash})` : ""}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    redirectWithError(REPORT_PATH, `Status check failed: ${message}`);
  }
}

/** Step 2: approve CollateralOnramp to spend USDC.e — must be confirmed on-chain before Step 3 will succeed. */
export async function approveForWrap(formData: FormData): Promise<void> {
  await requireAdminSession();
  const amountUsdc = parsePositiveAmount(formData, WRAP_TO_COLLATERAL_CAP_USDC);

  await logAdminAction({
    action: "capital-circle.wrap-approve.attempt",
    entityType: "capital_circle_wallet",
    entityId: "collateral-bridge",
    summary: `Approving CollateralOnramp to spend $${amountUsdc.toFixed(2)} USDC.e.`,
    metadata: { amountUsdc },
  });

  try {
    const result = await approveUsdcEForWrap(amountUsdc);
    await logAdminAction({
      action: "capital-circle.wrap-approve.success",
      entityType: "capital_circle_wallet",
      entityId: "collateral-bridge",
      summary: `Approve submitted: Circle tx ${result.id}.`,
      metadata: { amountUsdc, circleTransactionId: result.id },
    });
    redirectWithSuccess(REPORT_PATH, `Approve submitted (tx ${result.id}). Wait for it to confirm on-chain, then use "Wrap to pUSD" below.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await logAdminAction({
      action: "capital-circle.wrap-approve.failed",
      entityType: "capital_circle_wallet",
      entityId: "collateral-bridge",
      summary: `Approve failed: ${message}`,
      metadata: { amountUsdc, error: message },
    });
    redirectWithError(REPORT_PATH, `Approve failed: ${message}`);
  }
}

/** Step 3: mint pUSD from the now-approved USDC.e. */
export async function wrapToCollateral(formData: FormData): Promise<void> {
  await requireAdminSession();
  const amountUsdc = parsePositiveAmount(formData, WRAP_TO_COLLATERAL_CAP_USDC);

  await logAdminAction({
    action: "capital-circle.wrap-collateral.attempt",
    entityType: "capital_circle_wallet",
    entityId: "collateral-bridge",
    summary: `Wrapping $${amountUsdc.toFixed(2)} USDC.e into pUSD.`,
    metadata: { amountUsdc },
  });

  try {
    const result = await wrapUsdcEToPusd(amountUsdc);
    await logAdminAction({
      action: "capital-circle.wrap-collateral.success",
      entityType: "capital_circle_wallet",
      entityId: "collateral-bridge",
      summary: `Wrap submitted: Circle tx ${result.id}.`,
      metadata: { amountUsdc, circleTransactionId: result.id },
    });
    revalidatePath(REPORT_PATH);
    updateTag(WALLET_ONCHAIN_TAG);
    redirectWithSuccess(REPORT_PATH, `Wrap submitted (tx ${result.id}) — check the wallet balance shortly.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await logAdminAction({
      action: "capital-circle.wrap-collateral.failed",
      entityType: "capital_circle_wallet",
      entityId: "collateral-bridge",
      summary: `Wrap failed: ${message}`,
      metadata: { amountUsdc, error: message },
    });
    redirectWithError(REPORT_PATH, `Wrap failed: ${message} — if this reverted, the approval from Step 2 may not have confirmed yet.`);
  }
}
