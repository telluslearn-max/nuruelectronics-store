"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "../prisma";
import { requireAdminSession } from "../admin-auth";
import { logAdminAction } from "../audit-log";
import { redirectWithError, redirectWithSuccess } from "../admin-feedback";
import { CAPITAL_CIRCLE_WALLET_STATUSES, parseEnumField } from "../parse-enum";
import { evaluateIdentityChange, normalizeAddress } from "./wallet-identity";
import { getWalletBalanceSnapshot, WALLET_ONCHAIN_TAG } from "../reports/capital-circle-wallet";
import { circleWalletAddress, circleWalletId as configuredCircleWalletId } from "./circle-wallet-client";
import { CAPITAL_CIRCLE_NETWORK } from "./chain";

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
 * Registers what's already true on Circle's side — never sets caps or a non-"pending" status
 * here. Both are a separate decision with a separate timing (you might register today and want
 * to think about spending limits before this wallet does anything real), so cramming them into
 * one form was compound complexity nobody needed at registration time; the caps form already
 * sitting on each wallet row handles that once this exists. Chain is never asked for either — a
 * wallet on any chain but CAPITAL_CIRCLE_NETWORK would immediately fail the address-agreement
 * check the readiness panel already runs, so there's no legitimate reason to let it vary.
 */
export async function registerCapitalCircleWallet(formData: FormData): Promise<void> {
  await requireAdminSession();

  const circleWalletId = String(formData.get("circleWalletId") ?? "").trim();
  const rawAddress = String(formData.get("address") ?? "").trim();

  if (!circleWalletId) redirectWithError(REPORT_PATH, "Circle wallet id is required.");
  if (!rawAddress) redirectWithError(REPORT_PATH, "Address is required.");

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
    data: { circleWalletId, address, chain: CAPITAL_CIRCLE_NETWORK.key, status: "pending" },
  });
  await logAdminAction({
    action: "capital-circle.wallet.register",
    entityType: "capital_circle_wallet",
    entityId: wallet.id,
    summary: `Capital Circle wallet ${circleWalletId} registered.`,
    metadata: { circleWalletId, address, chain: CAPITAL_CIRCLE_NETWORK.key },
  });

  revalidatePath(REPORT_PATH);
  redirectWithSuccess(REPORT_PATH, "Wallet registered.");
}

/**
 * The one-click path: CIRCLE_WALLET_ID/CIRCLE_WALLET_ADDRESS are already env-configured and
 * already the values every other part of this app (the QR, live trading, Binance withdrawals)
 * actually uses — asking someone to retype them into a form is asking for exactly the kind of
 * mismatch the readiness panel's address-agreement check exists to catch. Takes no user input at
 * all; nothing here can be tampered with client-side because nothing here comes from the client.
 */
export async function registerConfiguredCircleWallet(): Promise<void> {
  await requireAdminSession();

  if (!circleWalletAddress || !configuredCircleWalletId) {
    redirectWithError(REPORT_PATH, "No Circle wallet is configured in the environment yet.");
  }

  // Normalized the same way every other path stores an address (checksummed) — CIRCLE_WALLET_ADDRESS
  // is whatever case an operator happened to paste into .env, and comparing it raw against
  // already-checksummed DB rows could miss a real match on case alone.
  const normalized = normalizeAddress(circleWalletAddress);
  if (!normalized.ok) redirectWithError(REPORT_PATH, `CIRCLE_WALLET_ADDRESS isn't a valid address: ${normalized.reason}`);

  const existing = await prisma.capitalCircleWallet.findFirst({
    where: { OR: [{ circleWalletId: configuredCircleWalletId }, { address: normalized.address }] },
  });
  if (existing) {
    redirectWithError(REPORT_PATH, "This wallet is already registered.");
  }

  const wallet = await prisma.capitalCircleWallet.create({
    data: { circleWalletId: configuredCircleWalletId, address: normalized.address, chain: CAPITAL_CIRCLE_NETWORK.key, status: "pending" },
  });
  await logAdminAction({
    action: "capital-circle.wallet.register",
    entityType: "capital_circle_wallet",
    entityId: wallet.id,
    summary: `Capital Circle wallet ${configuredCircleWalletId} registered from environment configuration.`,
    metadata: { circleWalletId: configuredCircleWalletId, address: normalized.address, chain: CAPITAL_CIRCLE_NETWORK.key, source: "env" },
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

/**
 * Manual refresh for the balance panel — bypasses the 30s cache on demand. Also the one place a
 * balance discrepancy actually gets logged: the cached snapshot loader itself stays a pure read
 * with no side effects, specifically so a persisting gap doesn't fire an audit-log write on every
 * cache expiry it survives (every 30s, for as long as it's wrong). A human clicking refresh is a
 * naturally bounded, low-frequency trigger for that record instead.
 *
 * updateTag rather than revalidateTag: this is the textbook read-your-own-writes case — the
 * getWalletBalanceSnapshot() call right below must see the fresh value in this same execution,
 * not the stale-while-revalidate value revalidateTag's "max" profile would still serve once.
 */
export async function refreshWalletOnchainData(): Promise<void> {
  await requireAdminSession();

  updateTag(WALLET_ONCHAIN_TAG);
  revalidatePath(REPORT_PATH);

  const snapshot = await getWalletBalanceSnapshot();
  if (snapshot.discrepancyUsd !== null && snapshot.onchainCollateral?.ok && snapshot.circleCollateral?.ok) {
    await logAdminAction({
      action: "capital-circle.wallet.balance-discrepancy",
      entityType: "capital_circle_wallet",
      entityId: snapshot.address ?? "circle-wallet",
      summary:
        `On-chain collateral ($${snapshot.onchainCollateral.value.toFixed(2)}) and Circle's reported balance ` +
        `($${snapshot.circleCollateral.amount.toFixed(2)}) disagree by $${Math.abs(snapshot.discrepancyUsd).toFixed(2)}.`,
      metadata: { onchain: snapshot.onchainCollateral.value, circle: snapshot.circleCollateral.amount, discrepancyUsd: snapshot.discrepancyUsd },
    }).catch(() => {}); // never let a log failure break the refresh itself
  }

  redirectWithSuccess(REPORT_PATH, "Balances refreshed.");
}
