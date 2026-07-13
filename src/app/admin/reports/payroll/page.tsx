import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Payroll Register" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminPayrollRegisterPage() {
  await requireAdminSession();

  const payslips = await prisma.payslip.findMany({
    orderBy: { createdAt: "desc" },
    include: { employee: true, payRun: true, deductions: true },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Payroll Register</h2>
      <p className="mt-2 text-neutral-500">All payslips across pay runs.</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Payslip</th>
              <th className="py-2">Employee</th>
              <th className="py-2">Period</th>
              <th className="py-2 text-right">Gross</th>
              <th className="py-2 text-right">Deductions</th>
              <th className="py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((payslip) => {
              const totalDeductions = payslip.deductions.reduce((sum, d) => sum + Number(d.amount), 0);
              return (
                <tr key={payslip.id} className="border-b border-border-subtle/60">
                  <td className="py-2">{payslip.number}</td>
                  <td className="py-2">{payslip.employee.name}</td>
                  <td className="py-2">
                    {formatDate(payslip.payRun.periodStart)} – {formatDate(payslip.payRun.periodEnd)}
                  </td>
                  <td className="py-2 text-right">{formatPrice(payslip.grossPay.toString(), "KES")}</td>
                  <td className="py-2 text-right">{formatPrice(totalDeductions.toFixed(2), "KES")}</td>
                  <td className="py-2 text-right">{formatPrice(payslip.netPay.toString(), "KES")}</td>
                </tr>
              );
            })}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">
                  No payslips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
