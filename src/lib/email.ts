import "server-only";
import { Resend } from "resend";
import { formatPrice } from "./format";
import { SITE_URL } from "./site";
import type { CapitalCircleSweep, Customer, DeliveryNote, Employee, Estimate, Invoice, Payslip, Receipt } from "@prisma/client";
import type { CapitalCircleCycleResult } from "./capital-circle/agent-loop";
import type { ProductReadinessViolation } from "./shopify/admin-api";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.DOCUMENT_EMAIL_FROM;
const capitalCircleOwnerEmail = process.env.CAPITAL_CIRCLE_OWNER_EMAIL;
const productReadinessOwnerEmail = process.env.PRODUCT_READINESS_OWNER_EMAIL;

export const isEmailConfigured = Boolean(apiKey && from);

const resend = apiKey ? new Resend(apiKey) : null;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes a value interpolated into an outgoing HTML email — customer/employee names are
 * admin- or Shopify-sourced text, not markup, and must never be rendered as HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

async function sendDocumentEmail(options: {
  to: string;
  subject: string;
  html: string;
  pdfBuffer: Buffer;
  filename: string;
}): Promise<void> {
  if (!resend || !from) {
    throw new Error(
      "Email isn't configured yet — set RESEND_API_KEY and DOCUMENT_EMAIL_FROM to send documents by email.",
    );
  }
  const { error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: [{ filename: options.filename, content: options.pdfBuffer }],
  });
  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Attachment-less sibling of sendDocumentEmail, for notifications rather than
 * documents. Unlike sendDocumentEmail, this degrades non-fatally when email
 * isn't configured — it's used from crons that shouldn't fail just because
 * nobody's set up Resend yet.
 */
export async function sendPlainEmail(options: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend || !from) {
    console.log(`[email] not configured — skipping "${options.subject}" to ${options.to}.`);
    return;
  }
  const { error } = await resend.emails.send({ from, to: options.to, subject: options.subject, html: options.html });
  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Notifies the owner that a week's sweep is staged and needs a manual
 * USD→USDC conversion + confirmation. Degrades non-fatally (logs and
 * returns) when CAPITAL_CIRCLE_OWNER_EMAIL isn't set, same as when email
 * itself isn't configured — the sweep row still exists either way.
 */
export async function sendSweepReadyEmail(sweep: CapitalCircleSweep): Promise<void> {
  if (!capitalCircleOwnerEmail) {
    console.log("[capital-circle] CAPITAL_CIRCLE_OWNER_EMAIL not set — skipping sweep-ready notification.");
    return;
  }
  const weekLabel = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(sweep.weekStart);
  const reportUrl = `${SITE_URL}/admin/reports/capital-circle`;
  await sendPlainEmail({
    to: capitalCircleOwnerEmail,
    subject: `Capital Circle: $${Number(sweep.sweepAmountUsd).toFixed(2)} ready to sweep (week of ${weekLabel})`,
    html: `<p>This week's profit was $${Number(sweep.totalProfitUsd).toFixed(2)}. ${Number(sweep.splitPercent)}% of that — $${Number(sweep.sweepAmountUsd).toFixed(2)} — is staged for the Capital Circle wallet.</p><p>Convert it to USDC (Circle Mint or an exchange), send it to the wallet, then confirm the amount received here: <a href="${reportUrl}">${reportUrl}</a></p>`,
  });
}

/**
 * Notifies the owner what the weekly Researcher/Risk-Sizing/Executor cycle actually did — the
 * cron itself only logs to console, so without this there's no way to know what market it
 * researched or what it decided short of checking the admin page. Degrades non-fatally when
 * CAPITAL_CIRCLE_OWNER_EMAIL isn't set, same as sendSweepReadyEmail — a missing notification
 * should never fail the cron or hide that the cycle ran.
 */
export async function sendCapitalCircleCycleEmail(result: CapitalCircleCycleResult): Promise<void> {
  if (!capitalCircleOwnerEmail) {
    console.log("[capital-circle] CAPITAL_CIRCLE_OWNER_EMAIL not set — skipping cycle-summary notification.");
    return;
  }
  const dateLabel = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date());
  const reportUrl = `${SITE_URL}/admin/reports/capital-circle`;
  const summaryHtml = escapeHtml(result.summary).replace(/\n/g, "<br>");
  await sendPlainEmail({
    to: capitalCircleOwnerEmail,
    subject: result.ran
      ? `Capital Circle: this week's cycle summary (${dateLabel})`
      : `Capital Circle: this week's cycle didn't run (${dateLabel})`,
    html: `<p>${summaryHtml}</p><p>${result.toolCallCount} tool call${result.toolCallCount === 1 ? "" : "s"} this cycle. Full position history: <a href="${reportUrl}">${reportUrl}</a></p>`,
  });
}

/**
 * Notifies the owner which live products would fail the readiness bar (image, real
 * price, real description, SEO fields) — the cron itself only logs, so without this
 * there's no way to know a listing needs attention short of running the check
 * manually. Degrades non-fatally when PRODUCT_READINESS_OWNER_EMAIL isn't set, same
 * as the Capital Circle notifications above — a missing notification should never
 * fail the cron.
 */
export async function sendProductReadinessEmail(checked: number, violations: ProductReadinessViolation[]): Promise<void> {
  if (!productReadinessOwnerEmail) {
    console.log("[product-readiness] PRODUCT_READINESS_OWNER_EMAIL not set — skipping readiness notification.");
    return;
  }
  if (violations.length === 0) return; // Nothing to flag — don't email a clean bill of health daily.

  const dateLabel = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date());
  const rows = violations
    .map((v) => `<li><strong>${escapeHtml(v.title)}</strong> (/${escapeHtml(v.handle)}): ${escapeHtml(v.reasons.join(", "))}</li>`)
    .join("");
  await sendPlainEmail({
    to: productReadinessOwnerEmail,
    subject: `${violations.length} product${violations.length === 1 ? "" : "s"} failing readiness checks (${dateLabel})`,
    html: `<p>${violations.length} of ${checked} checked products are missing an image, a real price, a real description, or SEO fields:</p><ul>${rows}</ul>`,
  });
}

function estimateResponseUrl(estimate: Estimate): string {
  return `${SITE_URL}/estimates/${estimate.id}?token=${estimate.accessToken}`;
}

export async function sendEstimateEmail(estimate: Estimate, customer: Customer, pdfBuffer: Buffer): Promise<void> {
  if (!customer.email) throw new Error("Customer has no email on file.");
  const link = estimateResponseUrl(estimate);
  await sendDocumentEmail({
    to: customer.email,
    subject: `Estimate ${estimate.number} from NURU`,
    html: `<p>Hi ${escapeHtml(customer.name ?? "")},</p><p>Please find attached estimate ${estimate.number}, valid until ${new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(estimate.validUntil)}.</p><p>You can accept or decline it here: <a href="${link}">${link}</a></p>`,
    pdfBuffer,
    filename: `${estimate.number}.pdf`,
  });
}

export async function sendInvoiceEmail(invoice: Invoice, customer: Customer, pdfBuffer: Buffer): Promise<void> {
  if (!customer.email) throw new Error("Customer has no email on file.");
  await sendDocumentEmail({
    to: customer.email,
    subject: `Invoice ${invoice.number} from NURU`,
    html: `<p>Hi ${escapeHtml(customer.name ?? "")},</p><p>Please find attached invoice ${invoice.number} for ${formatPrice(invoice.total.toString(), "KES")}.</p>`,
    pdfBuffer,
    filename: `${invoice.number}.pdf`,
  });
}

export async function sendInvoiceReminderEmail(invoice: Invoice, customer: Customer, pdfBuffer: Buffer): Promise<void> {
  if (!customer.email) throw new Error("Customer has no email on file.");
  const balance = Number(invoice.total) - Number(invoice.amountPaid);
  await sendDocumentEmail({
    to: customer.email,
    subject: `Reminder: Invoice ${invoice.number} is overdue`,
    html: `<p>Hi ${escapeHtml(customer.name ?? "")},</p><p>This is a reminder that invoice ${invoice.number} for ${formatPrice(balance.toFixed(2), "KES")} is overdue. Please find it attached.</p>`,
    pdfBuffer,
    filename: `${invoice.number}.pdf`,
  });
}

export async function sendReceiptEmail(receipt: Receipt, customer: Customer, pdfBuffer: Buffer): Promise<void> {
  if (!customer.email) throw new Error("Customer has no email on file.");
  await sendDocumentEmail({
    to: customer.email,
    subject: `Receipt ${receipt.number} from NURU`,
    html: `<p>Hi ${escapeHtml(customer.name ?? "")},</p><p>Thank you for your payment. Please find your receipt ${receipt.number} attached.</p>`,
    pdfBuffer,
    filename: `${receipt.number}.pdf`,
  });
}

export async function sendDeliveryNoteEmail(note: DeliveryNote, customer: Customer, pdfBuffer: Buffer): Promise<void> {
  if (!customer.email) throw new Error("Customer has no email on file.");
  await sendDocumentEmail({
    to: customer.email,
    subject: `Delivery note ${note.number} from NURU`,
    html: `<p>Hi ${escapeHtml(customer.name ?? "")},</p><p>Please find attached delivery note ${note.number}.</p>`,
    pdfBuffer,
    filename: `${note.number}.pdf`,
  });
}

export async function sendPayslipEmail(payslip: Payslip, employee: Employee, pdfBuffer: Buffer): Promise<void> {
  if (!employee.email) throw new Error("Employee has no email on file.");
  await sendDocumentEmail({
    to: employee.email,
    subject: `Payslip ${payslip.number} from NURU`,
    html: `<p>Hi ${escapeHtml(employee.name)},</p><p>Please find your payslip ${payslip.number} attached.</p>`,
    pdfBuffer,
    filename: `${payslip.number}.pdf`,
  });
}
