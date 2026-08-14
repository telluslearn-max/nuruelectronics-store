import "server-only";
import { Resend } from "resend";
import { formatPrice } from "./format";
import { SITE_URL } from "./site";
import { getLetterhead } from "./pdf/letterhead";
import { OG_THEME } from "./og-theme";
import type { Customer, DeliveryNote, Employee, Estimate, GiftCardFulfillment, Invoice, Payslip, Receipt } from "@prisma/client";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.DOCUMENT_EMAIL_FROM;
const opsAlertEmail = process.env.OPS_ALERT_EMAIL;

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

async function sendPlainEmail(options: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend || !from) {
    throw new Error("Email isn't configured yet — set RESEND_API_KEY and DOCUMENT_EMAIL_FROM to send email.");
  }
  const { error } = await resend.emails.send({ from, to: options.to, subject: options.subject, html: options.html });
  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/** Wraps `bodyHtml` in a branded header (logo or wordmark) + footer (support contact), reusing the same
 * Settings-sourced letterhead the PDF documents use, so this doesn't drift from the rest of the brand. */
async function renderBrandedEmailHtml(bodyHtml: string): Promise<string> {
  const letterhead = await getLetterhead();
  const headerHtml = letterhead.logoDataUri
    ? `<img src="${letterhead.logoDataUri}" alt="${escapeHtml(letterhead.companyName)}" height="36" style="display:block;" />`
    : `<span style="font-size:20px;font-weight:700;color:${OG_THEME.foreground};">${escapeHtml(letterhead.companyName)}</span>`;
  const contactLine = [letterhead.companyEmail, letterhead.companyPhone].filter(Boolean).map((v) => escapeHtml(v as string)).join(" &middot; ");

  return `
    <div style="max-width:480px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
      <div style="background:${OG_THEME.background};padding:20px 24px;border-radius:8px 8px 0 0;">${headerHtml}</div>
      <div style="border:1px solid #e5e5e5;border-top:none;padding:24px;border-radius:0 0 8px 8px;">${bodyHtml}</div>
      ${contactLine ? `<p style="margin-top:16px;color:#71717a;font-size:12px;text-align:center;">${contactLine}</p>` : ""}
    </div>
  `;
}

export async function sendGiftCardCodeEmail(fulfillment: GiftCardFulfillment, customer: Customer): Promise<void> {
  if (!customer.email) throw new Error("Customer has no email on file.");
  const codeHtml = `
    <div style="margin:16px 0;padding:16px;background:#fafafa;border-left:4px solid ${OG_THEME.accent};border-radius:4px;">
      <p style="margin:0;">Code: <strong>${escapeHtml(fulfillment.cardNumber ?? "")}</strong></p>
      ${fulfillment.pinCode ? `<p style="margin:4px 0 0;">PIN: <strong>${escapeHtml(fulfillment.pinCode)}</strong></p>` : ""}
    </div>
  `;
  const instructionsHtml = fulfillment.redemptionInstructions
    ? `<p>${escapeHtml(fulfillment.redemptionInstructions)}</p>`
    : "";
  const bodyHtml = `<p>Hi ${escapeHtml(customer.name ?? "")},</p><p>Thanks for your order! Here's your gift card code:</p>${codeHtml}${instructionsHtml}`;
  await sendPlainEmail({
    to: customer.email,
    subject: "Your gift card code from NURU",
    html: await renderBrandedEmailHtml(bodyHtml),
  });
}

/** Internal ops notification (e.g. "customer paid, Reloadly fulfillment failed") — best-effort, silently
 * skipped rather than throwing when OPS_ALERT_EMAIL isn't set, since this alerting channel is optional. */
export async function sendOpsAlertEmail(subject: string, html: string): Promise<void> {
  if (!opsAlertEmail) return;
  await sendPlainEmail({ to: opsAlertEmail, subject, html });
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
