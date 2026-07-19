import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOverdueInvoices } from "@/lib/reports/overdue-invoices";
import { renderInvoicePdf } from "@/lib/pdf/render";
import { sendInvoiceReminderEmail } from "@/lib/email";

const REMINDER_THROTTLE_DAYS = 3;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runReminders() {
  const overdue = await getOverdueInvoices();
  const throttleCutoff = new Date(Date.now() - REMINDER_THROTTLE_DAYS * 24 * 60 * 60 * 1000);
  const due = overdue.filter((invoice) => !invoice.lastReminderSentAt || invoice.lastReminderSentAt < throttleCutoff);

  let sent = 0;
  let failed = 0;
  for (const candidate of due) {
    try {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: candidate.id },
        include: { order: { include: { customer: true, items: true } } },
      });
      const pdfBuffer = await renderInvoicePdf(invoice, invoice.order, invoice.order.customer, invoice.order.items);
      await sendInvoiceReminderEmail(invoice, invoice.order.customer, pdfBuffer);
      await prisma.invoice.update({ where: { id: invoice.id }, data: { lastReminderSentAt: new Date() } });
      sent++;
    } catch {
      // Missing customer email, email provider down, etc. — move on to the next candidate.
      failed++;
    }
  }

  return { candidates: due.length, sent, failed };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await runReminders();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await runReminders();
  return NextResponse.json(result);
}
