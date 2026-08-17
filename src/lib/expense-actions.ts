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

// One-time import of the "Build with Gemini XPRIZE" P&L statement's expense
// lines (M-Pesa acct 254745864474, 2 Jul - 14 Aug 2026). Idempotent — skips
// entries already recorded, so it's safe to click more than once.
const XPRIZE_PL_EXPENSES: {
  date: string;
  category: ExpenseCategory;
  subcategory: string;
  amount: number;
  description: string;
}[] = [
  { date: "2026-07-03", category: "cogs", subcategory: "Tokens", amount: 3107.16, description: "Anthropic Claude Subscription (receipt UG30GA7A1G)" },
  { date: "2026-07-13", category: "cogs", subcategory: "Tokens", amount: 1338.78, description: "Google Cloud (receipt UGD0GBG2FB)" },
  { date: "2026-08-13", category: "cogs", subcategory: "Tokens", amount: 3107.16, description: "Anthropic Claude Subscription (receipt UHD0G304QA)" },
  { date: "2026-07-08", category: "cogs", subcategory: "Software Subscriptions", amount: 133.83, description: "Shopify (receipt UG80GARX6E)" },
  { date: "2026-08-13", category: "cogs", subcategory: "Software Subscriptions", amount: 133.93, description: "Shopify (receipt UHD0G2Z84K)" },
  { date: "2026-07-18", category: "cogs", subcategory: "Personnel", amount: 407.00, description: "Delivery rider Suleiman Okanga (receipt UGI0G00REL)" },
  { date: "2026-08-03", category: "cogs", subcategory: "Personnel", amount: 1123.00, description: "Delivery rider Suleiman Okanga (receipt UH30G1VCK8)" },
  { date: "2026-08-07", category: "cogs", subcategory: "Personnel", amount: 6178.00, description: "Delivery rider Suleiman Okanga (receipt UH70G2COJP)" },
  { date: "2026-08-11", category: "cogs", subcategory: "Personnel", amount: 207.00, description: "Delivery rider Suleiman Okanga (receipt UHB0G2SHNV)" },
  { date: "2026-08-12", category: "cogs", subcategory: "Personnel", amount: 813.00, description: "Delivery rider Suleiman Okanga (receipt UHC0G2X9T7)" },
  { date: "2026-07-14", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 5057.00, description: "Abdirashid Abdi (receipt UGE0GBHA2Y)" },
  { date: "2026-07-17", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 2033.00, description: "Stephen Mwova (receipt UGH0GBUE3D)" },
  { date: "2026-07-18", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 38108.00, description: "Suleiman Okanga (receipt UGI0G00SHG)" },
  { date: "2026-07-19", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 1192.00, description: "Sally (I&M Bank C2B) (receipt UGJ0G04UOV)" },
  { date: "2026-07-21", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 7578.00, description: "Mohammed Aldhubaibi (receipt UGL0G0EYKB)" },
  { date: "2026-07-22", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 12100.00, description: "Mohammed Aldhubaibi (receipt UGM0G0I4QL)" },
  { date: "2026-07-28", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 26608.00, description: "Mohammed Aldhubaibi (receipt UGS0G166RD)" },
  { date: "2026-08-03", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 3025.00, description: "Sally (I&M Bank C2B) (receipt UH30G1V0OA)" },
  { date: "2026-08-03", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 1523.00, description: "Stephen Mwova (receipt UH30G1V4S7)" },
  { date: "2026-08-03", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 39378.00, description: "Fewa AT A Y N Fashion Shop, agent till cash payment (receipt UH30G1V9VE)" },
  { date: "2026-08-05", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 5578.00, description: "Abdirashid Abdi (receipt UH50G23Q8I)" },
  { date: "2026-08-11", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 2825.00, description: "Sally (I&M Bank C2B) (receipt UHB0G2RWZW)" },
  { date: "2026-08-12", category: "other", subcategory: "Supplier Settlement for Goods Sold", amount: 26072.00, description: "Absa Bank Kenya PLC (receipt UHC0G2WZT5)" },
  { date: "2026-07-11", category: "other", subcategory: "Rent", amount: 7042.00, description: "Co-operative Bank, Acc. 142 (receipt UGB0GB6UCR)" },
  { date: "2026-07-12", category: "other", subcategory: "Rent", amount: 4534.00, description: "Co-operative Bank, Acc. 142 (receipt UGC0GB9L54)" },
  { date: "2026-07-21", category: "other", subcategory: "Rent", amount: 16261.00, description: "Co-operative Bank, Acc. 631003#G01 (receipt UGL0G0F27T)" },
];

export async function importXprizePlExpenses(): Promise<void> {
  await requireAdminSession();

  let imported = 0;
  for (const entry of XPRIZE_PL_EXPENSES) {
    const date = new Date(entry.date);
    const amount = entry.amount.toFixed(2);

    const existing = await prisma.expense.findFirst({
      where: { date, subcategory: entry.subcategory, amount, description: entry.description },
    });
    if (existing) continue;

    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          date,
          category: entry.category,
          subcategory: entry.subcategory,
          amount,
          description: entry.description,
          paidFrom: "mpesa",
        },
      });
      await postJournalEntry(tx, {
        date,
        description: `Expense: ${entry.subcategory}`,
        sourceType: "expense",
        sourceId: expense.id,
        lines: [
          { accountCode: expenseAccountFor(entry.category, entry.subcategory), debit: entry.amount },
          { accountCode: cashAccountForSource("mpesa"), credit: entry.amount },
        ],
      });
      await logAdminAction(
        {
          action: "expense.create",
          entityType: "expense",
          entityId: expense.id,
          summary: `Recorded ${entry.category} expense "${entry.subcategory}" of ${amount} from mpesa (XPRIZE P&L import)`,
          metadata: { category: entry.category, subcategory: entry.subcategory, amount: entry.amount, paidFrom: "mpesa", source: "xprize_pl_statement.pdf" },
        },
        tx,
      );
    });
    imported++;
  }

  revalidatePath("/admin/expenses");
  redirectWithSuccess("/admin/expenses", imported > 0 ? `Imported ${imported} XPRIZE P&L expense(s).` : "XPRIZE P&L expenses already imported.");
}
