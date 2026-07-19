import "server-only";
import { prisma } from "../prisma";
import { rowsToCsv } from "./csv";

export type OutstandingInvoice = {
  id: string;
  orderId: string;
  number: string;
  status: string;
  dueAt: Date | null;
  balance: number;
  currencyCode: string;
  customerName: string;
};

/** Every non-void, non-fully-paid invoice with a positive balance, oldest first — the Debtors Ledger. */
export async function getOutstandingInvoices(): Promise<OutstandingInvoice[]> {
  const invoices = await prisma.invoice.findMany({
    where: { status: { notIn: ["paid", "void"] } },
    include: { order: { include: { customer: true } } },
    orderBy: { createdAt: "asc" },
  });

  return invoices
    .map((invoice) => ({
      id: invoice.id,
      orderId: invoice.orderId,
      number: invoice.number,
      status: invoice.status,
      dueAt: invoice.dueAt,
      balance: Number(invoice.total) - Number(invoice.amountPaid),
      currencyCode: invoice.order.currencyCode,
      customerName: invoice.order.customer.name ?? invoice.order.customer.email,
    }))
    .filter((invoice) => invoice.balance > 0);
}

/** Outstanding invoices that are also past their due date. */
export async function getOverdueInvoices(asOf: Date = new Date()): Promise<OutstandingInvoice[]> {
  const outstanding = await getOutstandingInvoices();
  return outstanding.filter((invoice) => invoice.dueAt !== null && invoice.dueAt < asOf);
}

export function outstandingInvoicesToCsv(rows: OutstandingInvoice[]): string {
  const total = rows.reduce((sum, row) => sum + row.balance, 0);
  return rowsToCsv(
    ["Invoice", "Customer", "Status", "Due date", "Balance"],
    [
      ...rows.map((row) => [
        row.number,
        row.customerName,
        row.status,
        row.dueAt ? row.dueAt.toISOString().slice(0, 10) : "",
        row.balance.toFixed(2),
      ]),
      ["", "", "", "Total", total.toFixed(2)],
    ],
  );
}
