import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type {
  Customer,
  DeliveryNote,
  Employee,
  Estimate,
  Invoice,
  Order,
  OrderItem,
  PayRun,
  Payslip,
  PayslipDeduction,
  Receipt,
} from "@prisma/client";
import { EstimateDocument } from "./estimate-document";
import { InvoiceDocument } from "./invoice-document";
import { ReceiptDocument } from "./receipt-document";
import { DeliveryNoteDocument } from "./delivery-note-document";
import { PayslipDocument } from "./payslip-document";
import { getLetterhead, type Letterhead } from "./letterhead";

/**
 * Fetches the current letterhead and renders `Document` with it merged into its own props, then
 * buffers the PDF. Every `render*Pdf` export below does exactly this — factored out once so each
 * of them stays a thin, still-distinctly-typed one-liner instead of five copies of the same two
 * lines (A Philosophy of Software Design, Ch. 6/7: shared scaffolding pulled out, per-document
 * prop shapes — which genuinely differ, e.g. only invoices take `receipts` — left alone).
 */
async function renderWithLetterhead<P extends { letterhead?: Letterhead }>(
  Document: (props: P) => ReactElement<DocumentProps>,
  props: Omit<P, "letterhead">,
): Promise<Buffer> {
  const letterhead = await getLetterhead();
  return renderToBuffer(Document({ ...props, letterhead } as P));
}

export async function renderEstimatePdf(
  estimate: Estimate,
  order: Order,
  customer: Customer,
  items: OrderItem[],
): Promise<Buffer> {
  return renderWithLetterhead(EstimateDocument, { estimate, order, customer, items });
}

export async function renderInvoicePdf(
  invoice: Invoice,
  order: Order,
  customer: Customer,
  items: OrderItem[],
  receipts: Receipt[],
): Promise<Buffer> {
  return renderWithLetterhead(InvoiceDocument, { invoice, order, customer, items, receipts });
}

export async function renderReceiptPdf(
  receipt: Receipt,
  invoice: Invoice,
  customer: Customer,
  items: OrderItem[],
): Promise<Buffer> {
  return renderWithLetterhead(ReceiptDocument, { receipt, invoice, customer, items });
}

export async function renderDeliveryNotePdf(note: DeliveryNote, order: Order, items: OrderItem[]): Promise<Buffer> {
  return renderWithLetterhead(DeliveryNoteDocument, { note, order, items });
}

export async function renderPayslipPdf(
  payslip: Payslip,
  employee: Employee,
  deductions: PayslipDeduction[],
  payRun: PayRun,
): Promise<Buffer> {
  return renderWithLetterhead(PayslipDocument, { payslip, employee, deductions, payRun });
}
