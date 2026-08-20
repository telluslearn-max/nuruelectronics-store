"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import { requireAdminSession } from "../admin-auth";
import { logAdminAction } from "../audit-log";
import { redirectWithError, redirectWithSuccess } from "../admin-feedback";
import { CAPITAL_CIRCLE_WALLET_STATUSES, parseEnumField } from "../parse-enum";
import { DEFAULT_ALLOWED_CHAINS, evaluateIdentityChange, normalizeAddress } from "./wallet-identity";

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
 * Create-only. A wallet with no address or no Circle id can't be used for anything, so both are
 * required here — unlike the caps/identity actions below, which each touch a strict subset of
 * fields specifically so neither can null out what the other doesn't ask about.
 */
export async function registerCapitalCircleWallet(formData: FormData): Promise<void> {
  await requireAdminSession();

  const circleWalletId = String(formData.get("circleWalletId") ?? "").trim();
  const rawAddress = String(formData.get("address") ?? "").trim();
  const chain = String(formData.get("chain") ?? "").trim() || "polygon";
  const status = parseEnumField(formData, "status", CAPITAL_CIRCLE_WALLET_STATUSES, REPORT_PATH);
  const perTxCapUsd = parseOptionalUsd(formData, "perTxCapUsd");
  const dailyCapUsd = parseOptionalUsd(formData, "dailyCapUsd");
  const weeklyCapUsd = parseOptionalUsd(formData, "weeklyCapUsd");
  const monthlyCapUsd = parseOptionalUsd(formData, "monthlyCapUsd");

  if (!circleWalletId) redirectWithError(REPORT_PATH, "Circle wallet id is required.");
  if (!rawAddress) redirectWithError(REPORT_PATH, "Address is required.");
  if (!DEFAULT_ALLOWED_CHAINS.includes(chain as (typeof DEFAULT_ALLOWED_CHAINS)[number])) {
    redirectWithError(REPORT_PATH, `Unrecognized chain "${chain}".`);
  }

  const normalized = normalizeAddress(rawAddress);
  if (!normalized.ok) redirectWithError(REPORT_PATH, normalized.reason);
  const address = normalized.address;

  const existing = await prisma.capitalCircleWallet.findFirst({
    where: { OR: [{ circleWalletId }, { address }] },
  });
  if (existing) {
    redirectWithError(REPORT_PATH, "That Circle wallet id or address is already registered — edit the existing row instead.");
  }

  const wallet = await prisma.capitalCircleWallet.create({
    data: {
      circleWalletId,
      address,
      chain,
      status,
      perTxCapUsd: perTxCapUsd?.toFixed(2) ?? null,
      dailyCapUsd: dailyCapUsd?.toFixed(2) ?? null,
      weeklyCapUsd: weeklyCapUsd?.toFixed(2) ?? null,
      monthlyCapUsd: monthlyCapUsd?.toFixed(2) ?? null,
    },
  });
  await logAdminAction({
    action: "capital-circle.wallet.register",
    entityType: "capital_circle_wallet",
    entityId: wallet.id,
    summary: `Capital Circle wallet ${circleWalletId} registered — status: ${status}.`,
    metadata: { circleWalletId, address, chain, status, perTxCapUsd, dailyCapUsd, weeklyCapUsd, monthlyCapUsd },
  });

  revalidatePath(REPORT_PATH);
  redirectWithSuccess(REPORT_PATH, "Wallet registered.");
}

/**
 * The everyday form — status and the four spending caps only. Deliberately has no `address` or
 * `circleWalletId` key anywhere in this function, not even read from formData: the bug this
 * replaced (saveCapitalCircleWallet) nulled the address whenever a combined form's address field
 * came back blank, because it wrote whatever the browser submitted unconditionally. That failure
 * mode is now structurally impossible here, not merely guarded against — there is nothing to null.
 */
export async function saveCapitalCircleWalletCaps(formData: FormData): Promise<void> {
  await requireAdminSession();

  const walletId = String(formData.get("walletId") ?? "").trim();
  if (!walletId) redirectWithError(REPORT_PATH, "No wallet specified.");

  const wallet = await prisma.capitalCircleWallet.findUnique({ where: { id: walletId } });
  if (!wallet) redirectWithError(REPORT_PATH, "That wallet no longer exists.");

  const status = parseEnumField(formData, "status", CAPITAL_CIRCLE_WALLET_STATUSES, REPORT_PATH);
  const perTxCapUsd = parseOptionalUsd(formData, "perTxCapUsd");
  const dailyCapUsd = parseOptionalUsd(formData, "dailyCapUsd");
  const weeklyCapUsd = parseOptionalUsd(formData, "weeklyCapUsd");
  const monthlyCapUsd = parseOptionalUsd(formData, "monthlyCapUsd");

  const data = {
    status,
    perTxCapUsd: perTxCapUsd?.toFixed(2) ?? null,
    dailyCapUsd: dailyCapUsd?.toFixed(2) ?? null,
    weeklyCapUsd: weeklyCapUsd?.toFixed(2) ?? null,
    monthlyCapUsd: monthlyCapUsd?.toFixed(2) ?? null,
  };

  await prisma.capitalCircleWallet.update({ where: { id: walletId }, data });
  await logAdminAction({
    action: "capital-circle.wallet.caps-update",
    entityType: "capital_circle_wallet",
    entityId: walletId,
    summary: `Capital Circle wallet ${wallet?.circleWalletId ?? walletId} caps updated — status: ${status}, per-tx cap: ${perTxCapUsd ?? "unset"}.`,
    metadata: {
      before: {
        status: wallet?.status,
        perTxCapUsd: wallet?.perTxCapUsd?.toString() ?? null,
        dailyCapUsd: wallet?.dailyCapUsd?.toString() ?? null,
        weeklyCapUsd: wallet?.weeklyCapUsd?.toString() ?? null,
        monthlyCapUsd: wallet?.monthlyCapUsd?.toString() ?? null,
      },
      after: data,
    },
  });

  revalidatePath(REPORT_PATH);
  redirectWithSuccess(REPORT_PATH, "Wallet caps saved.");
}

/**
 * The guarded path for changing what this wallet actually IS — its address and Circle id. Hidden
 * behind a <details> and a confirm checkbox on the page precisely because this is the one place
 * that can still send the pool's money to a different destination; every guard here lives in
 * evaluateIdentityChange (wallet-identity.ts) so it's unit-tested, not re-derived by hand.
 */
export async function updateCapitalCircleWalletIdentity(formData: FormData): Promise<void> {
  await requireAdminSession();

  const walletId = String(formData.get("walletId") ?? "").trim();
  if (!walletId) redirectWithError(REPORT_PATH, "No wallet specified.");

  const wallet = await prisma.capitalCircleWallet.findUnique({ where: { id: walletId } });
  if (!wallet) redirectWithError(REPORT_PATH, "That wallet no longer exists.");

  const seenUpdatedAtMs = Number(formData.get("seenUpdatedAt") ?? 0);
  const confirmReplace = formData.get("confirmReplace") === "on";

  const result = evaluateIdentityChange({
    current: {
      address: wallet.address,
      circleWalletId: wallet.circleWalletId,
      chain: wallet.chain,
      updatedAtMs: wallet.updatedAt.getTime(),
    },
    submitted: {
      address: String(formData.get("address") ?? ""),
      circleWalletId: String(formData.get("circleWalletId") ?? ""),
      chain: String(formData.get("chain") ?? "").trim() || wallet.chain,
    },
    confirmReplace,
    seenUpdatedAtMs,
  });

  if (!result.ok) redirectWithError(REPORT_PATH, result.reason);
  if (!result.changed) redirectWithSuccess(REPORT_PATH, "No changes — identity already matched what you submitted.");

  const before = { address: wallet.address, circleWalletId: wallet.circleWalletId, chain: wallet.chain };

  try {
    await prisma.capitalCircleWallet.update({ where: { id: walletId }, data: result.next });
  } catch (error) {
    // The uniqueness check is best-effort above (evaluateIdentityChange doesn't touch the DB);
    // this is the actual guarantee against two wallets racing to claim the same address/id.
    if ((error as { code?: string }).code === "P2002") {
      redirectWithError(REPORT_PATH, "That address or Circle wallet id is already used by another wallet row.");
    }
    throw error;
  }

  await logAdminAction({
    action: "capital-circle.wallet.identity-change",
    entityType: "capital_circle_wallet",
    entityId: walletId,
    summary: `Capital Circle wallet identity changed: ${before.address ?? "unset"} / ${before.circleWalletId ?? "unset"} -> ${result.next.address} / ${result.next.circleWalletId}.`,
    metadata: { before, after: result.next, confirmed: confirmReplace },
  });

  revalidatePath(REPORT_PATH);
  redirectWithSuccess(REPORT_PATH, "Wallet identity updated.");
}

/**
 * Lifts the trading pause set by the drawdown circuit breaker (see
 * sizing-tool.ts). Deliberately a separate, explicit human action rather than
 * anything the agent can do for itself — the breaker exists precisely because
 * code cannot tell a run of bad luck from a broken thesis generator, so
 * resuming has to be someone's decision.
 */
export async function clearCapitalCirclePause(formData: FormData): Promise<void> {
  await requireAdminSession();

  const walletId = String(formData.get("walletId") ?? "").trim();
  if (!walletId) {
    redirectWithError(REPORT_PATH, "No wallet specified.");
  }

  const wallet = await prisma.capitalCircleWallet.findUnique({ where: { id: walletId } });
  if (!wallet) {
    redirectWithError(REPORT_PATH, "That wallet no longer exists.");
  }

  await prisma.capitalCircleWallet.update({ where: { id: walletId }, data: { pausedAt: null, pausedReason: null } });
  await logAdminAction({
    action: "capital-circle.wallet.unpause",
    entityType: "capital_circle_wallet",
    entityId: walletId,
    summary: `Capital Circle trading pause cleared by an admin (was: ${wallet?.pausedReason ?? "no reason recorded"}).`,
    metadata: { previousPausedAt: wallet?.pausedAt, previousReason: wallet?.pausedReason },
  });

  revalidatePath(REPORT_PATH);
  redirectWithSuccess(REPORT_PATH, "Trading resumed.");
}
