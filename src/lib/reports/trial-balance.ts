import "server-only";
import { getAccountBalances, type AccountBalance } from "./ledger-reports";
import { rowsToCsv } from "./csv";

export async function getTrialBalance(): Promise<AccountBalance[]> {
  return getAccountBalances();
}

export function trialBalanceToCsv(rows: AccountBalance[]): string {
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  return rowsToCsv(
    ["Code", "Account", "Debit", "Credit"],
    [
      ...rows.map((row) => [row.account.code, row.account.name, row.debit.toFixed(2), row.credit.toFixed(2)]),
      ["", "Total", totalDebit.toFixed(2), totalCredit.toFixed(2)],
    ],
  );
}
