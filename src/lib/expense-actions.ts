"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { ACCOUNTS, postJournalEntry } from "./ledger";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";
import { logAdminAction } from "./audit-log";
import type { ExpenseCategory, ExpensePaymentSource } from "@prisma/client";
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_SOURCES, parseEnumField } from "./parse-enum";

const EXPENSE_ACCOUNT_BY_SUBCATEGORY: Record<string, string> = {
  Personnel: ACCOUNTS.PERSONNEL_EXPENSE,
  "Software Subscriptions": ACCOUNTS.SOFTWARE_SUBSCRIPTIONS,
};

function expenseAccountFor(category: ExpenseCategory, subcategory: string): string {
  if (category === "cogs") return ACCOUNTS.COGS;
  if (category === "sga") return EXPENSE_ACCOUNT_BY_SUBCATEGORY[subcategory] ?? ACCOUNTS.PERSONNEL_EXPENSE;
  return ACCOUNTS.OTHER_OPERATING_EXPENSES;
}

function cashAccountForSource(source: ExpensePaymentSource): string {
  if (source === "cash") return ACCOUNTS.CASH;
  if (source === "mpesa") return ACCOUNTS.MPESA;
  return ACCOUNTS.PETTY_CASH;
}

export async function createExpense(formData: FormData): Promise<void> {
  await requireAdminSession();

  const date = new Date(String(formData.get("date") ?? ""));
  const category = parseEnumField(formData, "category", EXPENSE_CATEGORIES, "/admin/expenses");
  const subcategory = String(formData.get("subcategory") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const description = String(formData.get("description") ?? "").trim() || null;
  const paidFrom = parseEnumField(formData, "paidFrom", EXPENSE_PAYMENT_SOURCES, "/admin/expenses");

  if (!subcategory || amount <= 0) {
    redirectWithError("/admin/expenses", "A subcategory and a positive amount are required.");
  }

  if (paidFrom === "petty_cash") {
    const fund = await prisma.pettyCashFund.findFirst();
    if (!fund) {
      redirectWithError("/admin/expenses", "Create a petty cash fund first before recording petty cash expenses.");
    }

    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: { date, category, subcategory, amount: amount.toFixed(2), description, paidFrom },
      });
      await tx.pettyCashEntry.create({
        data: { fundId: fund.id, type: "expense", amount: amount.toFixed(2), description: description ?? subcategory, date },
      });
      await postJournalEntry(tx, {
        date,
        description: `Expense: ${subcategory}`,
        sourceType: "expense",
        sourceId: expense.id,
        lines: [
          { accountCode: expenseAccountFor(category, subcategory), debit: amount },
          { accountCode: ACCOUNTS.PETTY_CASH, credit: amount },
        ],
      });
      await logAdminAction(
        {
          action: "expense.create",
          entityType: "expense",
          entityId: expense.id,
          summary: `Recorded ${category} expense "${subcategory}" of ${amount.toFixed(2)} from petty cash`,
          metadata: { category, subcategory, amount, paidFrom },
        },
        tx,
      );
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: { date, category, subcategory, amount: amount.toFixed(2), description, paidFrom },
      });
      await postJournalEntry(tx, {
        date,
        description: `Expense: ${subcategory}`,
        sourceType: "expense",
        sourceId: expense.id,
        lines: [
          { accountCode: expenseAccountFor(category, subcategory), debit: amount },
          { accountCode: cashAccountForSource(paidFrom), credit: amount },
        ],
      });
      await logAdminAction(
        {
          action: "expense.create",
          entityType: "expense",
          entityId: expense.id,
          summary: `Recorded ${category} expense "${subcategory}" of ${amount.toFixed(2)} from ${paidFrom}`,
          metadata: { category, subcategory, amount, paidFrom },
        },
        tx,
      );
    });
  }

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/petty-cash");
  redirectWithSuccess("/admin/expenses", "Expense recorded.");
}
