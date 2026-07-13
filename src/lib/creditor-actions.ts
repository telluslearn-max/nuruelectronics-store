"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { mintDocumentNumber } from "./documents";
import { ACCOUNTS, cashAccountForMethod, postJournalEntry } from "./ledger";
import type { ExpenseCategory, PaymentMethod } from "@prisma/client";

export async function createSupplier(formData: FormData): Promise<void> {
  await requireAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name) throw new Error("Supplier name is required.");

  await prisma.supplier.create({ data: { name, email, phone } });
  revalidatePath("/admin/suppliers");
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
  const category = String(formData.get("category")) as ExpenseCategory;
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const billDate = new Date(String(formData.get("billDate") ?? ""));
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;

  if (!supplierId || !description || amount <= 0) {
    throw new Error("A supplier, description, and positive amount are required.");
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
  redirect(`/admin/bills/${bill.id}`);
}

function nextBillStatus(total: string, amountPaid: number): "partially_paid" | "paid" {
  return amountPaid >= Number(total) ? "paid" : "partially_paid";
}

export async function recordSupplierPayment(billId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const amount = Number(formData.get("amount") ?? 0) || 0;
  const method = String(formData.get("method")) as PaymentMethod;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const paidAtRaw = String(formData.get("paidAt") ?? "");
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();

  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");

  const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });

  await prisma.$transaction(async (tx) => {
    const payment = await tx.supplierPayment.create({
      data: { billId, amount: amount.toFixed(2), method, reference, paidAt },
    });

    const newAmountPaid = Number(bill.amountPaid) + amount;
    await tx.bill.update({
      where: { id: billId },
      data: { amountPaid: newAmountPaid.toFixed(2), status: nextBillStatus(bill.amount.toString(), newAmountPaid) },
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
  });

  revalidatePath(`/admin/bills/${billId}`);
  revalidatePath("/admin/bills");
}
