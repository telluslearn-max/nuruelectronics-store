import "server-only";
import { prisma } from "../prisma";
import { rowsToCsv } from "./csv";

export type OutstandingBill = {
  id: string;
  number: string;
  supplierName: string;
  status: string;
  dueAt: Date | null;
  balance: number;
};

/** Every not-fully-paid bill, oldest due date first — the Creditors Ledger. */
export async function getOutstandingBills(): Promise<OutstandingBill[]> {
  const bills = await prisma.bill.findMany({
    where: { status: { not: "paid" } },
    include: { supplier: true },
    orderBy: [{ dueAt: "asc" }, { billDate: "asc" }],
  });

  return bills.map((bill) => ({
    id: bill.id,
    number: bill.number,
    supplierName: bill.supplier.name,
    status: bill.status,
    dueAt: bill.dueAt,
    balance: Number(bill.amount) - Number(bill.amountPaid),
  }));
}

export function outstandingBillsToCsv(rows: OutstandingBill[]): string {
  const total = rows.reduce((sum, row) => sum + row.balance, 0);
  return rowsToCsv(
    ["Bill", "Supplier", "Status", "Due date", "Balance"],
    [
      ...rows.map((row) => [
        row.number,
        row.supplierName,
        row.status,
        row.dueAt ? row.dueAt.toISOString().slice(0, 10) : "",
        row.balance.toFixed(2),
      ]),
      ["", "", "", "Total", total.toFixed(2)],
    ],
  );
}
