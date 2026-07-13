import "server-only";
import { prisma } from "../prisma";
import type { Account, Prisma } from "@prisma/client";

export type AccountBalance = { account: Account; debit: number; credit: number };

async function aggregateLines(where?: Prisma.JournalLineWhereInput): Promise<AccountBalance[]> {
  const lines = await prisma.journalLine.findMany({ where, include: { account: true } });

  const byAccount = new Map<string, AccountBalance>();
  for (const line of lines) {
    const existing = byAccount.get(line.accountId) ?? { account: line.account, debit: 0, credit: 0 };
    existing.debit += Number(line.debit);
    existing.credit += Number(line.credit);
    byAccount.set(line.accountId, existing);
  }
  return [...byAccount.values()].sort((a, b) => a.account.code.localeCompare(b.account.code));
}

/** Cumulative debit/credit per account from the beginning of the ledger through `asOf` (inclusive). */
export async function getAccountBalances({ asOf }: { asOf?: Date } = {}): Promise<AccountBalance[]> {
  return aggregateLines(asOf ? { journalEntry: { date: { lte: asOf } } } : undefined);
}

/** Debit/credit per account for entries dated in [from, to) only — used for period statements like the Income Statement. */
export async function getAccountBalancesForPeriod({ from, to }: { from: Date; to: Date }): Promise<AccountBalance[]> {
  return aggregateLines({ journalEntry: { date: { gte: from, lt: to } } });
}

/** Debit-normal balance (assets/expenses read naturally as debit − credit). */
export function debitBalance(row: AccountBalance): number {
  return row.debit - row.credit;
}

/** Credit-normal balance (liabilities/equity/revenue read naturally as credit − debit). */
export function creditBalance(row: AccountBalance): number {
  return row.credit - row.debit;
}
