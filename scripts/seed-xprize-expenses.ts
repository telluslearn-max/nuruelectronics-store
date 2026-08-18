// One-off data load: records the expense side of the "Build with Gemini XPRIZE"
// P&L statement (xprize_pl_statement.pdf, M-Pesa acct 254745864474, 2 Jul - 14 Aug
// 2026) into /admin/expenses, mirroring createExpense()'s expense + journal +
// audit-log writes exactly (but via a bare PrismaClient, since prisma.ts /
// ledger.ts / audit-log.ts are all "server-only" and can't be imported from a
// plain script).
//
// Usage:
//   npx tsx scripts/seed-xprize-expenses.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ACCOUNTS = {
  MPESA: "1005",
  COGS: "5000",
  PERSONNEL_EXPENSE: "5100",
  SOFTWARE_SUBSCRIPTIONS: "5110",
  OTHER_OPERATING_EXPENSES: "5200",
} as const;

type Category = "cogs" | "sga" | "other";

type ExpenseInput = {
  date: string;
  category: Category;
  subcategory: string;
  amount: number;
  description: string;
};

function expenseAccountFor(category: Category): string {
  if (category === "cogs") return ACCOUNTS.COGS;
  if (category === "other") return ACCOUNTS.OTHER_OPERATING_EXPENSES;
  return ACCOUNTS.PERSONNEL_EXPENSE;
}

const entries: ExpenseInput[] = [
  // COGS - Tokens (Anthropic Claude + Google Cloud API charges)
  { date: "2026-07-03", category: "cogs", subcategory: "Tokens", amount: 3107.16, description: "Anthropic Claude Subscription (receipt UG30GA7A1G)" },
  { date: "2026-07-13", category: "cogs", subcategory: "Tokens", amount: 1338.78, description: "Google Cloud (receipt UGD0GBG2FB)" },
  { date: "2026-08-13", category: "cogs", subcategory: "Tokens", amount: 3107.16, description: "Anthropic Claude Subscription (receipt UHD0G304QA)" },

  // COGS - Software Subscriptions (Shopify platform fees)
  { date: "2026-07-08", category: "cogs", subcategory: "Software Subscriptions", amount: 133.83, description: "Shopify (receipt UG80GARX6E)" },
  { date: "2026-08-13", category: "cogs", subcategory: "Software Subscriptions", amount: 133.93, description: "Shopify (receipt UHD0G2Z84K)" },

  // COGS - Personnel (delivery/rider payments, Suleiman Okanga)
  { date: "2026-07-18", category: "cogs", subcategory: "Personnel", amount: 407.00, description: "Delivery rider Suleiman Okanga (receipt UGI0G00REL)" },
  { date: "2026-08-03", category: "cogs", subcategory: "Personnel", amount: 1123.00, description: "Delivery rider Suleiman Okanga (receipt UH30G1VCK8)" },
  { date: "2026-08-07", category: "cogs", subcategory: "Personnel", amount: 6178.00, description: "Delivery rider Suleiman Okanga (receipt UH70G2COJP)" },
  { date: "2026-08-11", category: "cogs", subcategory: "Personnel", amount: 207.00, description: "Delivery rider Suleiman Okanga (receipt UHB0G2SHNV)" },
  { date: "2026-08-12", category: "cogs", subcategory: "Personnel", amount: 813.00, description: "Delivery rider Suleiman Okanga (receipt UHC0G2X9T7)" },

  // Other Expenses - Supplier Settlement for Goods Sold
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

  // Other Expenses - Rent
  { date: "2026-07-11", category: "other", subcategory: "Rent", amount: 7042.00, description: "Co-operative Bank, Acc. 142 (receipt UGB0GB6UCR)" },
  { date: "2026-07-12", category: "other", subcategory: "Rent", amount: 4534.00, description: "Co-operative Bank, Acc. 142 (receipt UGC0GB9L54)" },
  { date: "2026-07-21", category: "other", subcategory: "Rent", amount: 16261.00, description: "Co-operative Bank, Acc. 631003#G01 (receipt UGL0G0F27T)" },
];

async function main() {
  const expectedTotal = entries.reduce((sum, e) => sum + e.amount, 0);
  console.log(`Loading ${entries.length} expenses, total KES ${expectedTotal.toFixed(2)}`);

  for (const entry of entries) {
    const date = new Date(entry.date);
    const amount = entry.amount;

    const existing = await prisma.expense.findFirst({
      where: { date, subcategory: entry.subcategory, amount: amount.toFixed(2), description: entry.description },
    });
    if (existing) {
      console.log(`skip (already recorded): ${entry.date} ${entry.subcategory} ${amount}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          date,
          category: entry.category,
          subcategory: entry.subcategory,
          amount: amount.toFixed(2),
          description: entry.description,
          paidFrom: "mpesa",
        },
      });

      const debitCode = expenseAccountFor(entry.category);
      const accounts = await tx.account.findMany({ where: { code: { in: [debitCode, ACCOUNTS.MPESA] } } });
      const accountByCode = new Map(accounts.map((a) => [a.code, a]));
      const debitAccount = accountByCode.get(debitCode);
      const creditAccount = accountByCode.get(ACCOUNTS.MPESA);
      if (!debitAccount || !creditAccount) {
        throw new Error(`Missing chart-of-accounts entry for ${debitCode} or ${ACCOUNTS.MPESA} — run prisma db seed first.`);
      }

      await tx.journalEntry.create({
        data: {
          date,
          description: `Expense: ${entry.subcategory}`,
          sourceType: "expense",
          sourceId: expense.id,
          lines: {
            create: [
              { accountId: debitAccount.id, debit: amount.toFixed(2), credit: "0" },
              { accountId: creditAccount.id, debit: "0", credit: amount.toFixed(2) },
            ],
          },
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: "expense.create",
          entityType: "expense",
          entityId: expense.id,
          summary: `Recorded ${entry.category} expense "${entry.subcategory}" of ${amount.toFixed(2)} from mpesa (XPRIZE P&L import)`,
          metadata: { category: entry.category, subcategory: entry.subcategory, amount, paidFrom: "mpesa", source: "xprize_pl_statement.pdf" } as Prisma.InputJsonValue,
        },
      });
    });

    console.log(`recorded: ${entry.date} ${entry.category}/${entry.subcategory} KES ${amount.toFixed(2)} — ${entry.description}`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
