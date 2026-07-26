"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { mintDocumentNumber } from "./documents";
import { ACCOUNTS, cashAccountForMethod, postJournalEntry } from "./ledger";
import { ActionGuardError, redirectWithError, redirectWithSuccess } from "./admin-feedback";
import { logAdminAction } from "./audit-log";
import type { ExpenseCategory } from "@prisma/client";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, parseEnumField } from "./parse-enum";

export async function createSupplier(formData: FormData): Promise<void> {
  await requireAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name) redirectWithError("/admin/suppliers", "Supplier name is required.");

  await prisma.supplier.create({ data: { name, email, phone } });
  revalidatePath("/admin/suppliers");
  redirectWithSuccess("/admin/suppliers", "Supplier added.");
}

function billExpenseAccount(category: ExpenseCategory): string {
  if (category === "cogs") return ACCOUNTS.COGS;
  if (category === "sga") return ACCOUNTS.PERSONNEL_EXPENSE;
  return ACCOUNTS.OTHER_OPERATING_EXPENSES;
}

export async function createBill(formData: FormData): Promise<void> {
  await requireAdminSession();

  const supplierId = String(formData.get("supplierId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const category = parseEnumField(formData, "category", EXPENSE_CATEGORIES, "/admin/bills");
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const billDate = new Date(String(formData.get("billDate") ?? ""));
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;

  if (!supplierId || !description || amount <= 0) {
    redirectWithError("/admin/bills", "A supplier, description, and positive amount are required.");
  }

  const bill = await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "bill");
    const created = await tx.bill.create({
      data: { number, supplierId, description, category, amount: amount.toFixed(2), billDate, dueAt },
    });
    await postJournalEntry(tx, {
      date: billDate,
      description: `Bill ${created.number} received`,
      sourceType: "bill",
      sourceId: created.id,
      lines: [
        { accountCode: billExpenseAccount(category), debit: amount },
        { accountCode: ACCOUNTS.ACCOUNTS_PAYABLE, credit: amount },
      ],
    });
    return created;
  });

  revalidatePath("/admin/bills");
  redirectWithSuccess(`/admin/bills/${bill.id}`, "Bill created.");
}

function nextBillStatus(total: string, amountPaid: number): "partially_paid" | "paid" {
  return amountPaid >= Number(total) ? "paid" : "partially_paid";
}

export async function recordSupplierPayment(billId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });

  const amount = Number(formData.get("amount") ?? 0) || 0;
  const method = parseEnumField(formData, "method", PAYMENT_METHODS, `/admin/bills/${billId}`);
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const paidAtRaw = String(formData.get("paidAt") ?? "");
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();

  if (amount <= 0) {
    redirectWithError(`/admin/bills/${billId}`, "Payment amount must be greater than zero.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: { billId, amount: amount.toFixed(2), method, reference, paidAt },
      });

      // Atomic increment (rather than computing amountPaid from the `bill` read
      // above, taken before this transaction opened) so two concurrent payments
      // against the same bill can't clobber each other's contribution.
      const updated = await tx.bill.update({
        where: { id: billId },
        data: { amountPaid: { increment: amount } },
      });
      // Checked post-increment (inside the same transaction, under the row lock the increment
      // just took) rather than against the pre-transaction `bill` read, so this can't race with
      // a concurrent payment the way a pre-check against a stale total would.
      if (Number(updated.amountPaid) > Number(updated.amount)) {
        throw new ActionGuardError("That payment would overpay the bill — reduce the amount.", `/admin/bills/${billId}`);
      }
      await tx.bill.update({
        where: { id: billId },
        data: { status: nextBillStatus(updated.amount.toString(), Number(updated.amountPaid)) },
      });

      await postJournalEntry(tx, {
        date: paidAt,
        description: `Payment against bill ${bill.number}`,
        sourceType: "supplier_payment",
        sourceId: payment.id,
        lines: [
          { accountCode: ACCOUNTS.ACCOUNTS_PAYABLE, debit: amount },
          { accountCode: cashAccountForMethod(method), credit: amount },
        ],
      });

      await logAdminAction(
        {
          action: "bill.recordPayment",
          entityType: "bill",
          entityId: billId,
          summary: `Recorded payment of ${amount.toFixed(2)} against bill ${bill.number}`,
          metadata: { amount, method, reference },
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof ActionGuardError) redirectWithError(error.redirectPath, error.message);
    throw error;
  }

  revalidatePath(`/admin/bills/${billId}`);
  revalidatePath("/admin/bills");
  redirectWithSuccess(`/admin/bills/${billId}`, "Payment recorded.");
}
