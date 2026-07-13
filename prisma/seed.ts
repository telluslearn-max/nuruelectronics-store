import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { AccountType } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CHART_OF_ACCOUNTS: { code: string; name: string; type: AccountType }[] = [
  { code: "1000", name: "Cash on Hand", type: "asset" },
  { code: "1002", name: "Petty Cash", type: "asset" },
  { code: "1005", name: "M-Pesa", type: "asset" },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1500", name: "Fixed Assets", type: "asset" },
  { code: "1510", name: "Accumulated Depreciation", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "VAT Payable", type: "liability" },
  { code: "2200", name: "Payroll Liabilities", type: "liability" },
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "3900", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Sales Revenue", type: "revenue" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5100", name: "Personnel Expense", type: "expense" },
  { code: "5110", name: "Software Subscriptions", type: "expense" },
  { code: "5200", name: "Other Operating Expenses", type: "expense" },
  { code: "5300", name: "Depreciation Expense", type: "expense" },
];

async function main() {
  for (const account of CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: account.code },
      create: account,
      update: { name: account.name, type: account.type },
    });
  }
  console.log(`Seeded ${CHART_OF_ACCOUNTS.length} chart-of-accounts rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
