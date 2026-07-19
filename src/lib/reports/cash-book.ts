import "server-only";
import { prisma } from "../prisma";
import { ACCOUNTS } from "../ledger";
import { rowsToCsv } from "./csv";

export type CashBookRow = {
  id: string;
  date: Date;
  description: string;
  account: string;
  inflow: number;
  outflow: number;
  balance: number;
};

/** Cash on Hand and M-Pesa journal lines, in date order, with a running balance. */
export async function getCashBook(): Promise<CashBookRow[]> {
  const lines = await prisma.journalLine.findMany({
    where: { account: { code: { in: [ACCOUNTS.CASH, ACCOUNTS.MPESA] } } },
    include: { account: true, journalEntry: true },
    orderBy: { journalEntry: { date: "asc" } },
  });

  return lines.reduce<CashBookRow[]>((acc, line) => {
    const previousBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0;
    acc.push({
      id: line.id,
      date: line.journalEntry.date,
      description: line.journalEntry.description,
      account: line.account.name,
      inflow: Number(line.debit),
      outflow: Number(line.credit),
      balance: previousBalance + Number(line.debit) - Number(line.credit),
    });
    return acc;
  }, []);
}

export function cashBookToCsv(rows: CashBookRow[]): string {
  return rowsToCsv(
    ["Date", "Description", "Account", "In", "Out", "Balance"],
    rows.map((row) => [
      row.date.toISOString().slice(0, 10),
      row.description,
      row.account,
      row.inflow > 0 ? row.inflow.toFixed(2) : "",
      row.outflow > 0 ? row.outflow.toFixed(2) : "",
      row.balance.toFixed(2),
    ]),
  );
}
