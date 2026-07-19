import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { addPayslip, finalizePayRun, sendPayslipEmail } from "@/lib/payroll-actions";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = { title: "Pay Run" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";
const secondaryButtonClass =
  "rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground";

const DEDUCTION_ROWS = 4;

export default async function AdminPayRunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { success, error } = await searchParams;

  const payRun = await prisma.payRun.findUnique({
    where: { id },
    include: { payslips: { include: { employee: true, deductions: true } } },
  });
  if (!payRun) notFound();

  const employees = await prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const isDraft = payRun.status === "draft";

  return (
    <div>
      <h2 className="text-lg font-medium">
        Pay run: {formatDate(payRun.periodStart)} – {formatDate(payRun.periodEnd)}
      </h2>
      <FeedbackBanner success={success} error={error} />
      <p className="mt-1 text-sm text-neutral-500">
        Record-keeping only — gross pay and each deduction amount are entered by you or your accountant; this
        system does not compute statutory deductions.
      </p>
      <p className="mt-2 text-sm">Status: {payRun.status}</p>

      <ul className="mt-6 space-y-3">
        {payRun.payslips.map((payslip) => (
          <li key={payslip.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {payslip.number} · {payslip.employee.name} · Gross {formatPrice(payslip.grossPay.toString(), "KES")} ·
                Net {formatPrice(payslip.netPay.toString(), "KES")}
              </span>
              {payRun.status === "finalized" && (
                <div className="flex gap-2">
                  <a className="underline hover:text-foreground" href={`/api/payslips/${payslip.id}/pdf`}>
                    Download PDF
                  </a>
                  <form action={sendPayslipEmail.bind(null, payslip.id)}>
                    <button type="submit" className="underline hover:text-foreground">
                      Send email
                    </button>
                  </form>
                </div>
              )}
            </div>
            {payslip.deductions.length > 0 && (
              <p className="mt-1 text-neutral-500">
                {payslip.deductions.map((d) => `${d.type}: ${formatPrice(d.amount.toString(), "KES")}`).join(" · ")}
              </p>
            )}
          </li>
        ))}
        {payRun.payslips.length === 0 && <p className="text-sm text-neutral-500">No payslips added yet.</p>}
      </ul>

      {isDraft && (
        <>
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium">Add payslip</summary>
            <form action={addPayslip.bind(null, payRun.id)} className="mt-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-neutral-500">Employee</label>
                  <select name="employeeId" required className={inputClass}>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-500">Gross pay</label>
                  <input type="number" step="0.01" name="grossPay" required className={inputClass} />
                </div>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Deductions (type + amount, e.g. PAYE, NSSF, SHIF, Housing Levy)</p>
                <div className="mt-2 space-y-2">
                  {Array.from({ length: DEDUCTION_ROWS }).map((_, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" name={`deduction_type_${i}`} placeholder="Type" className={inputClass} />
                      <input type="number" step="0.01" name={`deduction_amount_${i}`} placeholder="Amount" className={inputClass} />
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" className={primaryButtonClass}>
                Add payslip
              </button>
            </form>
          </details>

          {payRun.payslips.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-medium">Finalize pay run</summary>
              <form action={finalizePayRun.bind(null, payRun.id)} className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-neutral-500">Disburse net pay from</label>
                  <select name="paidFrom" required className={inputClass}>
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                  </select>
                </div>
                <button type="submit" className={secondaryButtonClass}>
                  Finalize (posts to ledger)
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </div>
  );
}
