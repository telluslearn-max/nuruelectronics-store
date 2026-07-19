"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { ACCOUNTS, postJournalEntry } from "./ledger";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";
import type { ExpenseCategory, ExpensePaymentSource } from "@prisma/client";

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
  const category = String(formData.get("category")) as ExpenseCategory;
  const subcategory = String(formData.get("subcategory") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const description = String(formData.get("description") ?? "").trim() || null;
  const paidFrom = String(formData.get("paidFrom")) as ExpensePaymentSource;

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
    });
  }

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/petty-cash");
  redirectWithSuccess("/admin/expenses", "Expense recorded.");
}
