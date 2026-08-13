import "server-only";
import { Resend } from "resend";
import { formatPrice } from "./format";
import { SITE_URL } from "./site";
import type { Customer, DeliveryNote, Employee, Estimate, Invoice, Order, Payslip, Receipt } from "@prisma/client";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.DOCUMENT_EMAIL_FROM;

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

/** Like sendDocumentEmail but for messages with no PDF attachment (e.g. the feedback follow-up). */
async function sendPlainEmail(options: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend || !from) {
    throw new Error(
      "Email isn't configured yet — set RESEND_API_KEY and DOCUMENT_EMAIL_FROM to send documents by email.",
    );
  }
  const { error } = await resend.emails.send({ from, to: options.to, subject: options.subject, html: options.html });
  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendFeedbackFollowupEmail(order: Order, customer: Customer, feedbackToken: string): Promise<void> {
  if (!customer.email) throw new Error("Customer has no email on file.");
  const link = `${SITE_URL}/feedback/${feedbackToken}`;
  await sendPlainEmail({
    to: customer.email,
    subject: "How was your NURU order?",
    html: `<p>Hi ${escapeHtml(customer.name ?? "")},</p><p>It's been a couple of weeks since your order${
      order.shopifyOrderName ? ` ${escapeHtml(order.shopifyOrderName)}` : ""
    } — we'd love to hear how it went. It only takes a minute:</p><p><a href="${link}">${link}</a></p>`,
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
