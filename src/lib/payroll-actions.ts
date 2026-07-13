"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { mintDocumentNumber } from "./documents";
import { ACCOUNTS, cashAccountForMethod, postJournalEntry } from "./ledger";
import { renderPayslipPdf } from "./pdf/render";
import { sendPayslipEmail as sendPayslipEmailMessage } from "./email";
import type { PaymentMethod } from "@prisma/client";

export async function createEmployee(formData: FormData): Promise<void> {
  await requireAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "").trim() || null;
  if (!name) throw new Error("Employee name is required.");

  await prisma.employee.create({ data: { name, email, phone, role } });
  revalidatePath("/admin/payroll/employees");
}

export async function createPayRun(formData: FormData): Promise<void> {
  await requireAdminSession();

  const periodStart = new Date(String(formData.get("periodStart") ?? ""));
  const periodEnd = new Date(String(formData.get("periodEnd") ?? ""));
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    throw new Error("A valid period start and end are required.");
  }

  const payRun = await prisma.payRun.create({ data: { periodStart, periodEnd } });
  revalidatePath("/admin/payroll/runs");
  redirect(`/admin/payroll/runs/${payRun.id}`);
}

function parseDeductions(formData: FormData): { type: string; amount: number }[] {
  const deductions: { type: string; amount: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const type = formData.get(`deduction_type_${i}`);
    const amount = Number(formData.get(`deduction_amount_${i}`)) || 0;
    if (!type || String(type).trim() === "" || amount <= 0) continue;
    deductions.push({ type: String(type).trim(), amount });
  }
  return deductions;
}

export async function addPayslip(payRunId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const employeeId = String(formData.get("employeeId") ?? "");
  const grossPay = Number(formData.get("grossPay") ?? 0) || 0;
  const deductions = parseDeductions(formData);
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const netPay = grossPay - totalDeductions;

  if (!employeeId || grossPay <= 0) throw new Error("An employee and a positive gross pay are required.");
  if (netPay < 0) throw new Error("Deductions cannot exceed gross pay.");

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "payslip");
    await tx.payslip.create({
      data: {
        number,
        payRunId,
        employeeId,
        grossPay: grossPay.toFixed(2),
        netPay: netPay.toFixed(2),
        deductions: { create: deductions.map((d) => ({ type: d.type, amount: d.amount.toFixed(2) })) },
      },
    });
  });

  revalidatePath(`/admin/payroll/runs/${payRunId}`);
}

export async function finalizePayRun(payRunId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const paidFrom = String(formData.get("paidFrom")) as PaymentMethod;
  const payRun = await prisma.payRun.findUniqueOrThrow({
    where: { id: payRunId },
    include: { payslips: { include: { deductions: true } } },
  });
  if (payRun.payslips.length === 0) throw new Error("Add at least one payslip before finalizing.");

  await prisma.$transaction(async (tx) => {
    for (const payslip of payRun.payslips) {
      const totalDeductions = payslip.deductions.reduce((sum, d) => sum + Number(d.amount), 0);
      await postJournalEntry(tx, {
        date: payRun.periodEnd,
        description: `Payslip ${payslip.number} — pay run ${payRun.id.slice(0, 8)}`,
        sourceType: "payslip",
        sourceId: payslip.id,
        lines: [
          { accountCode: ACCOUNTS.PERSONNEL_EXPENSE, debit: Number(payslip.grossPay) },
          ...(totalDeductions > 0
            ? [{ accountCode: ACCOUNTS.PAYROLL_LIABILITIES, credit: totalDeductions }]
            : []),
          { accountCode: cashAccountForMethod(paidFrom), credit: Number(payslip.netPay) },
        ],
      });
    }
    await tx.payRun.update({ where: { id: payRunId }, data: { status: "finalized" } });
  });

  revalidatePath(`/admin/payroll/runs/${payRunId}`);
}

export async function sendPayslipEmail(payslipId: string): Promise<void> {
  await requireAdminSession();
  const payslip = await prisma.payslip.findUniqueOrThrow({
    where: { id: payslipId },
    include: { employee: true, deductions: true, payRun: true },
  });
  if (!payslip.employee.email) throw new Error("Employee has no email on file.");

  const pdfBuffer = await renderPayslipPdf(payslip, payslip.employee, payslip.deductions, payslip.payRun);
  await sendPayslipEmailMessage(payslip, payslip.employee, pdfBuffer);

  await prisma.payslip.update({ where: { id: payslipId }, data: { sentAt: new Date() } });
  revalidatePath(`/admin/payroll/runs/${payslip.payRunId}`);
}
