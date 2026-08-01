import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
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
import { getLetterhead } from "./letterhead";

export async function renderEstimatePdf(
  estimate: Estimate,
  order: Order,
  customer: Customer,
  items: OrderItem[],
): Promise<Buffer> {
  const letterhead = await getLetterhead();
  return renderToBuffer(EstimateDocument({ estimate, order, customer, items, letterhead }));
}

export async function renderInvoicePdf(
  invoice: Invoice,
  order: Order,
  customer: Customer,
  items: OrderItem[],
): Promise<Buffer> {
  const letterhead = await getLetterhead();
  return renderToBuffer(InvoiceDocument({ invoice, order, customer, items, letterhead }));
}

export async function renderReceiptPdf(
  receipt: Receipt,
  invoice: Invoice,
  customer: Customer,
  items: OrderItem[],
): Promise<Buffer> {
  const letterhead = await getLetterhead();
  return renderToBuffer(ReceiptDocument({ receipt, invoice, customer, items, letterhead }));
}

export async function renderDeliveryNotePdf(note: DeliveryNote, order: Order, items: OrderItem[]): Promise<Buffer> {
  const letterhead = await getLetterhead();
  return renderToBuffer(DeliveryNoteDocument({ note, order, items, letterhead }));
}

export async function renderPayslipPdf(
  payslip: Payslip,
  employee: Employee,
  deductions: PayslipDeduction[],
  payRun: PayRun,
): Promise<Buffer> {
  const letterhead = await getLetterhead();
  return renderToBuffer(PayslipDocument({ payslip, employee, deductions, payRun, letterhead }));
}
