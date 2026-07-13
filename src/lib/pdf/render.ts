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

export async function renderEstimatePdf(
  estimate: Estimate,
  order: Order,
  customer: Customer,
  items: OrderItem[],
): Promise<Buffer> {
  return renderToBuffer(EstimateDocument({ estimate, order, customer, items }));
}

export async function renderInvoicePdf(
  invoice: Invoice,
  order: Order,
  customer: Customer,
  items: OrderItem[],
): Promise<Buffer> {
  return renderToBuffer(InvoiceDocument({ invoice, order, customer, items }));
}

export async function renderReceiptPdf(receipt: Receipt, invoice: Invoice, customer: Customer): Promise<Buffer> {
  return renderToBuffer(ReceiptDocument({ receipt, invoice, customer }));
}

export async function renderDeliveryNotePdf(note: DeliveryNote, order: Order, items: OrderItem[]): Promise<Buffer> {
  return renderToBuffer(DeliveryNoteDocument({ note, order, items }));
}

export async function renderPayslipPdf(
  payslip: Payslip,
  employee: Employee,
  deductions: PayslipDeduction[],
  payRun: PayRun,
): Promise<Buffer> {
  return renderToBuffer(PayslipDocument({ payslip, employee, deductions, payRun }));
}
