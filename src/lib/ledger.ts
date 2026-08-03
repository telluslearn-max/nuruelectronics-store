import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Chart of Accounts codes, seeded once via prisma/seed.ts. Referenced by code
 * (not id) from calling code so account rows never need to be looked up by
 * hand — postJournalEntry() resolves codes to ids itself.
 */
export const ACCOUNTS = {
  CASH: "1000",
  PETTY_CASH: "1002",
  MPESA: "1005",
  ACCOUNTS_RECEIVABLE: "1100",
  FIXED_ASSETS: "1500",
  ACCUMULATED_DEPRECIATION: "1510",
  ACCOUNTS_PAYABLE: "2000",
  REFUNDS_PAYABLE: "2050",
  VAT_PAYABLE: "2100",
  PAYROLL_LIABILITIES: "2200",
  OWNERS_EQUITY: "3000",
  RETAINED_EARNINGS: "3900",
  SALES_REVENUE: "4000",
  SALES_RETURNS: "4100",
  COGS: "5000",
  PERSONNEL_EXPENSE: "5100",
  SOFTWARE_SUBSCRIPTIONS: "5110",
  OTHER_OPERATING_EXPENSES: "5200",
  DEPRECIATION_EXPENSE: "5300",
} as const;

export function cashAccountForMethod(method: "cash" | "mpesa"): string {
  return method === "cash" ? ACCOUNTS.CASH : ACCOUNTS.MPESA;
}

type JournalLineInput = { accountCode: string; debit?: number; credit?: number };

type PostJournalEntryInput = {
  date: Date;
  description: string;
  sourceType?: string;
  sourceId?: string;
  lines: JournalLineInput[];
};

/**
 * Posts a balanced double-entry journal entry inside `tx`. Must be called
 * from within the same Prisma transaction as whatever business event
 * triggered it (a Receipt, Expense, Bill payment, etc.), so the ledger
 * always reflects exactly what's committed.
 */
export async function postJournalEntry(
  tx: Prisma.TransactionClient,
  input: PostJournalEntryInput,
): Promise<{ id: string }> {
  const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new Error(`Journal entry does not balance: debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}`);
  }

  const codes = [...new Set(input.lines.map((line) => line.accountCode))];
  const accounts = await tx.account.findMany({ where: { code: { in: codes } } });
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));

  return tx.journalEntry.create({
    data: {
      date: input.date,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      lines: {
        create: input.lines.map((line) => {
          const account = accountByCode.get(line.accountCode);
          if (!account) throw new Error(`Unknown ledger account code: ${line.accountCode}`);
          return {
            accountId: account.id,
            debit: (line.debit ?? 0).toFixed(2),
            credit: (line.credit ?? 0).toFixed(2),
          };
        }),
      },
    },
    select: { id: true },
  });
}
