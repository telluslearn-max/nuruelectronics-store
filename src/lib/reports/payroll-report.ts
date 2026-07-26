import "server-only";
import { prisma } from "../prisma";
import { rowsToCsv } from "./csv";

export type PayrollRow = {
  id: string;
  number: string;
  employeeName: string;
  periodStart: Date;
  periodEnd: Date;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

/** Every payslip across pay runs, newest first — the Payroll Register. Optionally scoped to a
    pay-period date range and/or a page of results. */
export async function getPayrollReport(
  options: { from?: Date; to?: Date; skip?: number; take?: number } = {},
): Promise<{ rows: PayrollRow[]; totalCount: number }> {
  const { from, to, skip, take } = options;
  const where =
    from || to
      ? {
          payRun: {
            periodStart: from ? { gte: from } : undefined,
            periodEnd: to ? { lte: to } : undefined,
          },
        }
      : {};

  const [payslips, totalCount] = await Promise.all([
    prisma.payslip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { employee: true, payRun: true, deductions: true },
      skip,
      take,
    }),
    prisma.payslip.count({ where }),
  ]);

  const rows = payslips.map((payslip) => ({
    id: payslip.id,
    number: payslip.number,
    employeeName: payslip.employee.name,
    periodStart: payslip.payRun.periodStart,
    periodEnd: payslip.payRun.periodEnd,
    grossPay: Number(payslip.grossPay),
    totalDeductions: payslip.deductions.reduce((sum, d) => sum + Number(d.amount), 0),
    netPay: Number(payslip.netPay),
  }));

  return { rows, totalCount };
}

export function payrollReportToCsv(rows: PayrollRow[]): string {
  return rowsToCsv(
    ["Payslip", "Employee", "Period start", "Period end", "Gross", "Deductions", "Net"],
    rows.map((row) => [
      row.number,
      row.employeeName,
      row.periodStart.toISOString().slice(0, 10),
      row.periodEnd.toISOString().slice(0, 10),
      row.grossPay.toFixed(2),
      row.totalDeductions.toFixed(2),
      row.netPay.toFixed(2),
    ]),
  );
}
