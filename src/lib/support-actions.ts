"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "./admin-auth";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";
import { logAdminAction } from "./audit-log";
import { ACCOUNTS, cashAccountForMethod, postJournalEntry } from "./ledger";
import { prisma } from "./prisma";

/**
 * Approves an escalated case by hand — the AI agent's policy engine punted (past a self-service
 * window, or a case type it isn't allowed to decide alone) and a human is the one committing to the
 * refund amount. Posts the same accrual the agent posts for an auto-approved case, so the P&L
 * doesn't distinguish who authorized it, only that it happened.
 */
export async function approveEscalatedCase(formData: FormData): Promise<void> {
  await requireAdminSession();

  const caseId = String(formData.get("caseId") ?? "");
  const refundAmount = Number(formData.get("refundAmount"));
  const note = String(formData.get("note") ?? "").trim();

  const returnCase = await prisma.returnCase.findUnique({ where: { id: caseId } });
  if (!returnCase || returnCase.status !== "escalated") {
    redirectWithError("/admin/support", "That case isn't awaiting a decision.");
  }
  if (!refundAmount || refundAmount <= 0) {
    redirectWithError("/admin/support", "Enter a refund amount greater than zero.");
  }

  await prisma.$transaction(async (tx) => {
    const entry = await postJournalEntry(tx, {
      date: new Date(),
      description: `Refund approved by staff — order ${returnCase!.shopifyOrderName}`,
      sourceType: "returnCase",
      sourceId: returnCase!.shopifyOrderId,
      lines: [
        { accountCode: ACCOUNTS.SALES_RETURNS, debit: refundAmount },
        { accountCode: ACCOUNTS.REFUNDS_PAYABLE, credit: refundAmount },
      ],
    });

    await tx.returnCase.update({
      where: { id: caseId },
      data: {
        status: "approved",
        decidedBy: "admin",
        refundAmount: refundAmount.toFixed(2),
        refundChannel: "shopify_checkout",
        journalEntryId: entry.id,
        decisionBasis: note ? `${returnCase!.decisionBasis} — staff decision: ${note}` : returnCase!.decisionBasis,
      },
    });

    await logAdminAction(
      {
        action: "support.approveEscalatedCase",
        entityType: "returnCase",
        entityId: caseId,
        summary: `Staff approved refund for order ${returnCase!.shopifyOrderName}`,
        metadata: { refundAmount },
      },
      tx,
    );
  });

  revalidatePath("/admin/support");
  redirectWithSuccess("/admin/support", "Case approved and refund accrued.");
}

/** Denies an escalated case by hand — no financial entry, just closes it out with a reason on file. */
export async function denyCase(formData: FormData): Promise<void> {
  await requireAdminSession();

  const caseId = String(formData.get("caseId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const returnCase = await prisma.returnCase.findUnique({ where: { id: caseId } });
  if (!returnCase || returnCase.status !== "escalated") {
    redirectWithError("/admin/support", "That case isn't awaiting a decision.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.returnCase.update({
      where: { id: caseId },
      data: {
        status: "denied",
        decidedBy: "admin",
        resolvedAt: new Date(),
        decisionBasis: note ? `${returnCase!.decisionBasis} — staff decision: ${note}` : returnCase!.decisionBasis,
      },
    });

    await logAdminAction(
      {
        action: "support.denyCase",
        entityType: "returnCase",
        entityId: caseId,
        summary: `Staff denied case for order ${returnCase!.shopifyOrderName}`,
      },
      tx,
    );
  });

  revalidatePath("/admin/support");
  redirectWithSuccess("/admin/support", "Case denied.");
}

/**
 * Marks an approved case's refund as actually paid out — the accrual (Refunds Payable) was already
 * booked when the case was approved; this posts the second leg once cash/M-Pesa/Shopify actually
 * moves, and closes the case.
 */
export async function markCaseRefunded(formData: FormData): Promise<void> {
  await requireAdminSession();

  const caseId = String(formData.get("caseId") ?? "");
  const paidFrom = String(formData.get("paidFrom") ?? "");

  const returnCase = await prisma.returnCase.findUnique({ where: { id: caseId } });
  if (!returnCase || returnCase.status !== "approved" || !returnCase.refundAmount) {
    redirectWithError("/admin/support", "That case isn't an approved refund awaiting payout.");
  }
  if (paidFrom !== "cash" && paidFrom !== "mpesa") {
    redirectWithError("/admin/support", "Choose how the refund was paid out.");
  }

  await prisma.$transaction(async (tx) => {
    await postJournalEntry(tx, {
      date: new Date(),
      description: `Refund paid out — order ${returnCase!.shopifyOrderName}`,
      sourceType: "returnCase",
      sourceId: returnCase!.shopifyOrderId,
      lines: [
        { accountCode: ACCOUNTS.REFUNDS_PAYABLE, debit: Number(returnCase!.refundAmount) },
        { accountCode: cashAccountForMethod(paidFrom as "cash" | "mpesa"), credit: Number(returnCase!.refundAmount) },
      ],
    });

    await tx.returnCase.update({
      where: { id: caseId },
      data: { status: "refunded", resolvedAt: new Date() },
    });

    await logAdminAction(
      {
        action: "support.markCaseRefunded",
        entityType: "returnCase",
        entityId: caseId,
        summary: `Refund paid out for order ${returnCase!.shopifyOrderName} via ${paidFrom}`,
      },
      tx,
    );
  });

  revalidatePath("/admin/support");
  redirectWithSuccess("/admin/support", "Refund marked as paid out.");
}
