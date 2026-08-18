"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import { requireAdminSession } from "../admin-auth";
import { logAdminAction } from "../audit-log";
import { redirectWithError, redirectWithSuccess } from "../admin-feedback";
import { CAPITAL_CIRCLE_WALLET_STATUSES, parseEnumField } from "../parse-enum";

const REPORT_PATH = "/admin/reports/capital-circle";

function parseOptionalUsd(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    redirectWithError(REPORT_PATH, `${field} must be a non-negative number, or left blank.`);
  }
  return value;
}

/**
 * Records what's already true on Circle's side — it never calls Circle's API
 * to set anything. The wallet is provisioned via scripts/circle-wallet-setup.mjs
 * and its spending-policy caps are set directly on Circle (mainnet-only,
 * OTP-gated for changes); this form just mirrors those numbers into the app
 * so sizePosition() stops falling back to the code-level default and starts
 * agreeing with the real wallet-level limit, per design.
 */
export async function saveCapitalCircleWallet(formData: FormData): Promise<void> {
  await requireAdminSession();

  const walletId = String(formData.get("walletId") ?? "").trim() || null;
  const circleWalletId = String(formData.get("circleWalletId") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const chain = String(formData.get("chain") ?? "").trim() || "polygon";
  const status = parseEnumField(formData, "status", CAPITAL_CIRCLE_WALLET_STATUSES, REPORT_PATH);
  const perTxCapUsd = parseOptionalUsd(formData, "perTxCapUsd");
  const dailyCapUsd = parseOptionalUsd(formData, "dailyCapUsd");
  const weeklyCapUsd = parseOptionalUsd(formData, "weeklyCapUsd");
  const monthlyCapUsd = parseOptionalUsd(formData, "monthlyCapUsd");

  const data = {
    circleWalletId,
    address,
    chain,
    status,
    perTxCapUsd: perTxCapUsd?.toFixed(2) ?? null,
    dailyCapUsd: dailyCapUsd?.toFixed(2) ?? null,
    weeklyCapUsd: weeklyCapUsd?.toFixed(2) ?? null,
    monthlyCapUsd: monthlyCapUsd?.toFixed(2) ?? null,
  };

  if (!walletId && (circleWalletId || address)) {
    const existing = await prisma.capitalCircleWallet.findFirst({
      where: { OR: [circleWalletId ? { circleWalletId } : undefined, address ? { address } : undefined].filter((c) => c !== undefined) },
    });
    if (existing) {
      redirectWithError(REPORT_PATH, "That Circle wallet id or address is already registered — edit the existing row instead.");
    }
  }

  if (walletId) {
    await prisma.capitalCircleWallet.update({ where: { id: walletId }, data });
    await logAdminAction({
      action: "capital-circle.wallet.update",
      entityType: "capital_circle_wallet",
      entityId: walletId,
      summary: `Capital Circle wallet ${circleWalletId ?? walletId} updated — status: ${status}, per-tx cap: ${perTxCapUsd ?? "unset"}.`,
      metadata: { circleWalletId, address, chain, status, perTxCapUsd, dailyCapUsd, weeklyCapUsd, monthlyCapUsd },
    });
  } else {
    const wallet = await prisma.capitalCircleWallet.create({ data });
    await logAdminAction({
      action: "capital-circle.wallet.register",
      entityType: "capital_circle_wallet",
      entityId: wallet.id,
      summary: `Capital Circle wallet ${circleWalletId ?? wallet.id} registered — status: ${status}, per-tx cap: ${perTxCapUsd ?? "unset"}.`,
      metadata: { circleWalletId, address, chain, status, perTxCapUsd, dailyCapUsd, weeklyCapUsd, monthlyCapUsd },
    });
  }

  revalidatePath(REPORT_PATH);
  redirectWithSuccess(REPORT_PATH, walletId ? "Wallet updated." : "Wallet registered.");
}
