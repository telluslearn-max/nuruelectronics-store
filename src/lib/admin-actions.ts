"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { generateAccessToken, mintDocumentNumber } from "./documents";
import { ACCOUNTS, cashAccountForMethod, postJournalEntry } from "./ledger";
import { decrementVariantInventory, getShopifyOrderById } from "./shopify/admin-api";
import { isEmailConfigured, sendDeliveryNoteEmail as sendDeliveryNoteEmailMessage, sendEstimateEmail as sendEstimateEmailMessage, sendInvoiceEmail as sendInvoiceEmailMessage, sendReceiptEmail as sendReceiptEmailMessage } from "./email";
import { isWhatsAppSendConfigured, normalizeWhatsAppPhone, sendWhatsAppTemplate } from "./whatsapp-business";
import { renderDeliveryNotePdf, renderEstimatePdf, renderInvoicePdf, renderReceiptPdf } from "./pdf/render";
import { ActionGuardError, redirectWithError, redirectWithSuccess } from "./admin-feedback";
import { logAdminAction } from "./audit-log";
import { PAYMENT_METHODS, parseEnumField } from "./parse-enum";
import { formatPrice } from "./format";
import { SITE_URL } from "./site";

function parseLineItems(
  formData: FormData,
): { title: string; quantity: number; unitPrice: string; lineTotal: string; variantId?: string }[] {
  const items: { title: string; quantity: number; unitPrice: string; lineTotal: string; variantId?: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const title = formData.get(`item_title_${i}`);
    const quantity = formData.get(`item_qty_${i}`);
    const unitPrice = formData.get(`item_price_${i}`);
    const variantId = String(formData.get(`item_variant_${i}`) ?? "").trim() || undefined;
    if (!title || String(title).trim() === "") continue;
    const qty = Number(quantity) || 0;
    const price = Number(unitPrice) || 0;
    if (qty <= 0) continue;
    items.push({
      title: String(title).trim(),
      quantity: qty,
      unitPrice: price.toFixed(2),
      lineTotal: (qty * price).toFixed(2),
      variantId,
    });
  }
  return items;
}

export async function createManualOrder(formData: FormData): Promise<void> {
  await requireAdminSession();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const deductInventory = formData.get("deductInventory") === "on";
  const items = parseLineItems(formData);

  if (!email || items.length === 0) {
    redirectWithError("/admin/orders/new", "A customer email and at least one line item are required.");
  }

  const order = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email },
      create: { email, name, phone },
      update: { name: name ?? undefined, phone: phone ?? undefined },
    });

    return tx.order.create({
      data: {
        source: "manual",
        note,
        customerId: customer.id,
        items: { create: items },
      },
    });
  });

  // Best-effort only — the order itself is already committed above. A failed
  // Shopify inventory adjustment here (unmapped variant, no write_inventory
  // scope, network error, etc.) shouldn't undo a real recorded sale; the
  // owner can always correct Shopify's stock count by hand if this fails.
  if (deductInventory) {
    for (const item of items) {
      if (!item.variantId) continue;
      try {
        await decrementVariantInventory(item.variantId, item.quantity);
      } catch (error) {
        console.error(`Inventory sync failed for variant ${item.variantId}:`, error);
      }
    }
  }

  revalidatePath("/admin/orders");
  redirectWithSuccess(`/admin/orders/${order.id}`, "Order created.");
}

/** Imports a live Shopify order into our own Order/OrderItem tables on first use, so it can carry documents. Idempotent on shopifyOrderId. */
export async function importShopifyOrder(shopifyOrderId: string): Promise<void> {
  await requireAdminSession();

  const existing = await prisma.order.findUnique({ where: { shopifyOrderId } });
  if (existing) {
    redirect(`/admin/orders/${existing.id}`);
  }

  const shopifyOrder = await getShopifyOrderById(shopifyOrderId);
  if (!shopifyOrder) {
    redirectWithError("/admin/orders", "Shopify order not found.");
  }

  const email = shopifyOrder.customer?.email?.toLowerCase() ?? null;
  if (!email) {
    redirectWithError("/admin/orders", "This Shopify order has no customer email on file.");
  }

  const order = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email },
      create: { email, name: shopifyOrder.customer?.displayName ?? null, shopifyCustomerId: shopifyOrder.customer?.id },
      update: { shopifyCustomerId: shopifyOrder.customer?.id },
    });

    return tx.order.create({
      data: {
        source: "shopify",
        shopifyOrderId: shopifyOrder.id,
        shopifyOrderName: shopifyOrder.name,
        currencyCode: shopifyOrder.currentTotalPriceSet.shopMoney.currencyCode,
        customerId: customer.id,
        items: {
          create: shopifyOrder.lineItems.edges.map((edge) => ({
            title: edge.node.title,
            variantId: edge.node.variant?.id,
            quantity: edge.node.quantity,
            unitPrice: edge.node.originalUnitPriceSet.shopMoney.amount,
            lineTotal: (Number(edge.node.originalUnitPriceSet.shopMoney.amount) * edge.node.quantity).toFixed(2),
          })),
        },
      },
    });
  });

  revalidatePath("/admin/orders");
  redirectWithSuccess(`/admin/orders/${order.id}`, "Order imported from Shopify.");
}

function sumItems(items: { lineTotal: unknown }[]): number {
  return items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
}

export async function createEstimate(orderId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const validUntil = new Date(String(formData.get("validUntil")));
  const taxTotal = Number(formData.get("taxTotal") ?? 0) || 0;
  const shippingTotal = Number(formData.get("shippingTotal") ?? 0) || 0;
  const discountTotal = Number(formData.get("discountTotal") ?? 0) || 0;
  const note = String(formData.get("note") ?? "").trim() || null;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const subtotal = sumItems(order.items);
  const total = subtotal + taxTotal + shippingTotal - discountTotal;

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "estimate");
    await tx.estimate.create({
      data: {
        number,
        orderId,
        validUntil,
        accessToken: generateAccessToken(),
        subtotal: subtotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        shippingTotal: shippingTotal.toFixed(2),
        discountTotal: discountTotal.toFixed(2),
        total: total.toFixed(2),
        note,
      },
    });
  });

  revalidatePath(`/admin/orders/${orderId}`);
  redirectWithSuccess(`/admin/orders/${orderId}`, "Estimate created.");
}

export async function updateEstimate(estimateId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const estimate = await prisma.estimate.findUniqueOrThrow({
    where: { id: estimateId },
    include: { order: { include: { items: true } } },
  });

  if (estimate.status !== "draft" && estimate.status !== "sent") {
    redirectWithError(`/admin/orders/${estimate.orderId}`, "Can't edit an estimate the customer has already responded to.");
  }

  const validUntil = new Date(String(formData.get("validUntil")));
  const taxTotal = Number(formData.get("taxTotal") ?? 0) || 0;
  const shippingTotal = Number(formData.get("shippingTotal") ?? 0) || 0;
  const discountTotal = Number(formData.get("discountTotal") ?? 0) || 0;
  const note = String(formData.get("note") ?? "").trim() || null;

  const subtotal = sumItems(estimate.order.items);
  const total = subtotal + taxTotal + shippingTotal - discountTotal;

  await prisma.estimate.update({
    where: { id: estimateId },
    data: {
      validUntil,
      taxTotal: taxTotal.toFixed(2),
      shippingTotal: shippingTotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      total: total.toFixed(2),
      note,
    },
  });

  revalidatePath(`/admin/orders/${estimate.orderId}`);
  redirectWithSuccess(`/admin/orders/${estimate.orderId}`, "Estimate updated.");
}

async function deleteEstimateSilent(estimateId: string): Promise<{ orderId: string; number: string }> {
  const estimate = await prisma.estimate.findUniqueOrThrow({ where: { id: estimateId } });

  await prisma.estimate.delete({ where: { id: estimateId } });
  await logAdminAction({
    action: "estimate.delete",
    entityType: "estimate",
    entityId: estimateId,
    summary: `Deleted estimate ${estimate.number}`,
  });

  revalidatePath(`/admin/orders/${estimate.orderId}`);
  return { orderId: estimate.orderId, number: estimate.number };
}

export async function deleteEstimate(estimateId: string): Promise<void> {
  await requireAdminSession();
  const { orderId } = await deleteEstimateSilent(estimateId);
  redirectWithSuccess(`/admin/orders/${orderId}`, "Estimate deleted.");
}

async function sendEstimateEmailSilent(estimateId: string): Promise<{ orderId: string }> {
  const estimate = await prisma.estimate.findUniqueOrThrow({
    where: { id: estimateId },
    include: { order: { include: { customer: true, items: true } } },
  });
  if (!isEmailConfigured) {
    throw new ActionGuardError(
      "Email isn't configured — set RESEND_API_KEY and DOCUMENT_EMAIL_FROM.",
      `/admin/orders/${estimate.orderId}`,
    );
  }
  if (!estimate.order.customer.email) {
    throw new ActionGuardError("Customer has no email on file.", `/admin/orders/${estimate.orderId}`);
  }

  const pdfBuffer = await renderEstimatePdf(estimate, estimate.order, estimate.order.customer, estimate.order.items);
  await sendEstimateEmailMessage(estimate, estimate.order.customer, pdfBuffer);

  await prisma.estimate.update({
    where: { id: estimateId },
    data: { status: estimate.status === "draft" ? "sent" : estimate.status, sentAt: new Date() },
  });

  revalidatePath(`/admin/orders/${estimate.orderId}`);
  return { orderId: estimate.orderId };
}

export async function sendEstimateEmail(estimateId: string): Promise<void> {
  await requireAdminSession();
  try {
    const { orderId } = await sendEstimateEmailSilent(estimateId);
    redirectWithSuccess(`/admin/orders/${orderId}`, "Estimate emailed.");
  } catch (error) {
    if (error instanceof ActionGuardError) redirectWithError(error.redirectPath, error.message);
    throw error;
  }
}

export async function createInvoiceFromEstimate(estimateId: string): Promise<void> {
  await requireAdminSession();
  const estimate = await prisma.estimate.findUniqueOrThrow({ where: { id: estimateId } });

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "invoice");
    const invoice = await tx.invoice.create({
      data: {
        number,
        orderId: estimate.orderId,
        subtotal: estimate.subtotal,
        taxTotal: estimate.taxTotal,
        shippingTotal: estimate.shippingTotal,
        discountTotal: estimate.discountTotal,
        total: estimate.total,
        note: estimate.note,
        issuedAt: new Date(),
      },
    });
    await postJournalEntry(tx, {
      date: invoice.issuedAt ?? invoice.createdAt,
      description: `Invoice ${invoice.number} issued`,
      sourceType: "invoice",
      sourceId: invoice.id,
      lines: [
        { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: Number(invoice.total) },
        { accountCode: ACCOUNTS.SALES_REVENUE, credit: Number(invoice.total) },
      ],
    });
  });

  revalidatePath(`/admin/orders/${estimate.orderId}`);
  redirectWithSuccess(`/admin/orders/${estimate.orderId}`, "Invoice created from estimate.");
}

export async function createInvoice(orderId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const taxTotal = Number(formData.get("taxTotal") ?? 0) || 0;
  const shippingTotal = Number(formData.get("shippingTotal") ?? 0) || 0;
  const discountTotal = Number(formData.get("discountTotal") ?? 0) || 0;
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const subtotal = sumItems(order.items);
  const total = subtotal + taxTotal + shippingTotal - discountTotal;

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "invoice");
    const invoice = await tx.invoice.create({
      data: {
        number,
        orderId,
        subtotal: subtotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        shippingTotal: shippingTotal.toFixed(2),
        discountTotal: discountTotal.toFixed(2),
        total: total.toFixed(2),
        note,
        dueAt,
        issuedAt: new Date(),
      },
    });
    await postJournalEntry(tx, {
      date: invoice.issuedAt ?? invoice.createdAt,
      description: `Invoice ${invoice.number} issued`,
      sourceType: "invoice",
      sourceId: invoice.id,
      lines: [
        { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: Number(invoice.total) },
        { accountCode: ACCOUNTS.SALES_REVENUE, credit: Number(invoice.total) },
      ],
    });
  });

  revalidatePath(`/admin/orders/${orderId}`);
  redirectWithSuccess(`/admin/orders/${orderId}`, "Invoice created.");
}

export async function updateInvoice(invoiceId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { order: { include: { items: true } } },
  });

  if (Number(invoice.amountPaid) > 0) {
    redirectWithError(`/admin/orders/${invoice.orderId}`, "Can't edit an invoice that has received payments.");
  }
  if (invoice.status !== "draft" && invoice.status !== "sent") {
    redirectWithError(`/admin/orders/${invoice.orderId}`, "Can't edit a voided invoice.");
  }

  const taxTotal = Number(formData.get("taxTotal") ?? 0) || 0;
  const shippingTotal = Number(formData.get("shippingTotal") ?? 0) || 0;
  const discountTotal = Number(formData.get("discountTotal") ?? 0) || 0;
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const subtotal = sumItems(invoice.order.items);
  const total = subtotal + taxTotal + shippingTotal - discountTotal;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        taxTotal: taxTotal.toFixed(2),
        shippingTotal: shippingTotal.toFixed(2),
        discountTotal: discountTotal.toFixed(2),
        total: total.toFixed(2),
        note,
        dueAt,
      },
    });
    // Replace the ledger entry posted at issuance with one reflecting the corrected total.
    await tx.journalEntry.deleteMany({ where: { sourceType: "invoice", sourceId: invoiceId } });
    await postJournalEntry(tx, {
      date: updated.issuedAt ?? updated.createdAt,
      description: `Invoice ${updated.number} issued`,
      sourceType: "invoice",
      sourceId: updated.id,
      lines: [
        { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: Number(updated.total) },
        { accountCode: ACCOUNTS.SALES_REVENUE, credit: Number(updated.total) },
      ],
    });
  });

  revalidatePath(`/admin/orders/${invoice.orderId}`);
  redirectWithSuccess(`/admin/orders/${invoice.orderId}`, "Invoice updated.");
}

async function deleteInvoiceSilent(invoiceId: string): Promise<{ orderId: string; number: string }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  if (Number(invoice.amountPaid) > 0) {
    throw new ActionGuardError(
      "Can't delete an invoice that has received payments.",
      `/admin/orders/${invoice.orderId}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Removes every ledger effect this invoice ever had — the original issuance
    // posting and, if it was voided first, the reversal too — so deleting it
    // leaves no trace, unlike Void which deliberately keeps an audit trail.
    await tx.journalEntry.deleteMany({ where: { sourceId: invoiceId } });
    await tx.invoice.delete({ where: { id: invoiceId } });
  });
  await logAdminAction({
    action: "invoice.delete",
    entityType: "invoice",
    entityId: invoiceId,
    summary: `Deleted invoice ${invoice.number}`,
  });

  revalidatePath(`/admin/orders/${invoice.orderId}`);
  return { orderId: invoice.orderId, number: invoice.number };
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  await requireAdminSession();
  try {
    const { orderId } = await deleteInvoiceSilent(invoiceId);
    redirectWithSuccess(`/admin/orders/${orderId}`, "Invoice deleted.");
  } catch (error) {
    if (error instanceof ActionGuardError) redirectWithError(error.redirectPath, error.message);
    throw error;
  }
}

async function sendInvoiceEmailSilent(invoiceId: string): Promise<{ orderId: string }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { order: { include: { customer: true, items: true } }, receipts: true },
  });
  if (!isEmailConfigured) {
    throw new ActionGuardError(
      "Email isn't configured — set RESEND_API_KEY and DOCUMENT_EMAIL_FROM.",
      `/admin/orders/${invoice.orderId}`,
    );
  }
  if (!invoice.order.customer.email) {
    throw new ActionGuardError("Customer has no email on file.", `/admin/orders/${invoice.orderId}`);
  }

  const pdfBuffer = await renderInvoicePdf(
    invoice,
    invoice.order,
    invoice.order.customer,
    invoice.order.items,
    invoice.receipts,
  );
  await sendInvoiceEmailMessage(invoice, invoice.order.customer, pdfBuffer);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: invoice.status === "draft" ? "sent" : invoice.status, sentAt: new Date() },
  });

  revalidatePath(`/admin/orders/${invoice.orderId}`);
  return { orderId: invoice.orderId };
}

export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  await requireAdminSession();
  try {
    const { orderId } = await sendInvoiceEmailSilent(invoiceId);
    redirectWithSuccess(`/admin/orders/${orderId}`, "Invoice emailed.");
  } catch (error) {
    if (error instanceof ActionGuardError) redirectWithError(error.redirectPath, error.message);
    throw error;
  }
}

function nextInvoiceStatus(total: string, amountPaid: number): "sent" | "partially_paid" | "paid" {
  if (amountPaid <= 0) return "sent";
  if (amountPaid >= Number(total)) return "paid";
  return "partially_paid";
}

export async function recordPayment(invoiceId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  const amount = Number(formData.get("amount") ?? 0) || 0;
  const method = parseEnumField(formData, "method", PAYMENT_METHODS, `/admin/orders/${invoice.orderId}`);
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const paidAtRaw = String(formData.get("paidAt") ?? "");
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();

  if (amount <= 0) {
    redirectWithError(`/admin/orders/${invoice.orderId}`, "Payment amount must be greater than zero.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const number = await mintDocumentNumber(tx, "receipt");
      const receipt = await tx.receipt.create({
        data: { number, invoiceId, amount: amount.toFixed(2), method, reference, paidAt },
      });

      // Atomic increment (rather than computing amountPaid from the `invoice` read
      // above, taken before this transaction opened) so two concurrent payments
      // against the same invoice can't clobber each other's contribution.
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: { increment: amount } },
      });
      // Checked post-increment (inside the same transaction, under the row lock the increment
      // just took) rather than against the pre-transaction `invoice` read, so this can't race
      // with a concurrent payment the way a pre-check against a stale total would.
      if (Number(updated.amountPaid) > Number(updated.total)) {
        throw new ActionGuardError(
          "That payment would overpay the invoice — reduce the amount.",
          `/admin/orders/${invoice.orderId}`,
        );
      }
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: nextInvoiceStatus(updated.total.toString(), Number(updated.amountPaid)) },
      });

      await postJournalEntry(tx, {
        date: paidAt,
        description: `Receipt ${receipt.number} against invoice`,
        sourceType: "receipt",
        sourceId: receipt.id,
        lines: [
          { accountCode: cashAccountForMethod(method), debit: amount },
          { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, credit: amount },
        ],
      });

      await logAdminAction(
        {
          action: "invoice.recordPayment",
          entityType: "invoice",
          entityId: invoiceId,
          summary: `Recorded payment of ${amount.toFixed(2)} against invoice ${invoice.number}`,
          metadata: { amount, method, reference },
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof ActionGuardError) redirectWithError(error.redirectPath, error.message);
    throw error;
  }

  revalidatePath(`/admin/orders/${invoice.orderId}`);
  redirectWithSuccess(`/admin/orders/${invoice.orderId}`, "Payment recorded.");
}

// One-time import of the "Build with Gemini XPRIZE" P&L statement's revenue
// lines (M-Pesa acct 254745864474, 2 Jul - 14 Aug 2026): 28 "Independent
// Sales" payments. Each becomes a real Customer + manual Order + issued,
// fully-paid Invoice + Receipt — the same chain createManualOrder /
// createInvoice / recordPayment build by hand — so computePnl() picks the
// revenue up the normal way. Idempotent on the M-Pesa receipt number, so
// it's safe to run more than once. The statement only has customer display
// names, not emails/phones, so each distinct name gets a deterministic
// synthetic email (`<slug>@mpesa-import.local`) purely to satisfy Customer's
// unique-email constraint and to consolidate repeat names onto one customer.
const XPRIZE_PL_REVENUE: { date: string; receipt: string; customerName: string; amount: number }[] = [
  { date: "2026-07-04", receipt: "UG47EA0JCE", customerName: "Mercy Njogu", amount: 2800.00 },
  { date: "2026-07-06", receipt: "UG6NMA56F0", customerName: "Mark Kimani", amount: 4000.00 },
  { date: "2026-07-06", receipt: "UG67YA4MJ2", customerName: "Hudson Lubabali", amount: 34100.00 },
  { date: "2026-07-11", receipt: "UGBNMAPRA7", customerName: "Mark Kimani", amount: 6000.00 },
  { date: "2026-07-13", receipt: "UGDNMAY38W", customerName: "Mark Kimani", amount: 5500.00 },
  { date: "2026-07-14", receipt: "UGEPJB60UD", customerName: "Prescott Matendechero", amount: 6000.00 },
  { date: "2026-07-17", receipt: "UGHGWBMN1I", customerName: "Ongwae Zachary", amount: 2500.00 },
  { date: "2026-07-18", receipt: "UGI4302GFK", customerName: "Veronica Kamera", amount: 37000.00 },
  { date: "2026-07-18", receipt: "UGI4302JI4", customerName: "Veronica Kamera", amount: 5000.00 },
  { date: "2026-07-18", receipt: "UGI1V008TH", customerName: "David Gachago", amount: 1310.00 },
  { date: "2026-07-19", receipt: "UGJ0G07J2J", customerName: "KCB 1", amount: 1000.00 },
  { date: "2026-07-22", receipt: "UGM9H069JS", customerName: "Samwel Opande", amount: 500.00 },
  { date: "2026-07-22", receipt: "UGMMH0D5FW", customerName: "Sarran Otieno", amount: 20000.00 },
  { date: "2026-07-28", receipt: "UGSMH120ND", customerName: "Sarran Otieno", amount: 29500.00 },
  { date: "2026-08-01", receipt: "UH1FG1AQNU", customerName: "Vincent Kanana", amount: 6500.00 },
  { date: "2026-08-03", receipt: "UH3OG1K7P0", customerName: "Gillesvidaljunior Nguetti", amount: 2000.00 },
  { date: "2026-08-03", receipt: "UH30G1UVD5", customerName: "NCBA Bank - Salary", amount: 7600.00 },
  { date: "2026-08-03", receipt: "UH3G31BCLR", customerName: "Callary Ongare", amount: 43000.00 },
  { date: "2026-08-04", receipt: "UH40G1YHSM", customerName: "IM Bank Limited", amount: 500.00 },
  { date: "2026-08-05", receipt: "UH57Y1JRWJ", customerName: "Hudson Lubabali", amount: 7500.00 },
  { date: "2026-08-05", receipt: "UH5R418896", customerName: "Mark Muindi", amount: 3800.00 },
  { date: "2026-08-07", receipt: "UH7OG206GQ", customerName: "Gillesvidaljunior Nguetti", amount: 1800.00 },
  { date: "2026-08-07", receipt: "UH7HD2A61U", customerName: "Kelly Wachira", amount: 7500.00 },
  { date: "2026-08-08", receipt: "UH80G2FYG3", customerName: "KCB 1", amount: 1000.00 },
  { date: "2026-08-08", receipt: "UH80G2IR2H", customerName: "Absa Bank Kenya PLC", amount: 6000.00 },
  { date: "2026-08-11", receipt: "UHBRG2M58N", customerName: "Ejidiah Muthoni", amount: 4400.00 },
  { date: "2026-08-11", receipt: "UHB6P2EGOY", customerName: "Erick Otieno", amount: 2950.00 },
  { date: "2026-08-12", receipt: "UHC1S2JD6G", customerName: "Naomi Warutere", amount: 30000.00 },
];

function xprizeCustomerEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}@mpesa-import.local`;
}

export async function importXprizePlRevenue(): Promise<void> {
  await requireAdminSession();

  let imported = 0;
  for (const entry of XPRIZE_PL_REVENUE) {
    const existing = await prisma.receipt.findFirst({ where: { reference: entry.receipt } });
    if (existing) continue;

    const date = new Date(entry.date);
    const amount = entry.amount.toFixed(2);
    const email = xprizeCustomerEmail(entry.customerName);

    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email },
        create: { email, name: entry.customerName },
        update: { name: entry.customerName },
      });

      const order = await tx.order.create({
        data: {
          source: "manual",
          note: `XPRIZE P&L import — M-Pesa receipt ${entry.receipt}`,
          customerId: customer.id,
          items: {
            create: [{ title: "Independent Sale (XPRIZE P&L import)", quantity: 1, unitPrice: amount, lineTotal: amount }],
          },
        },
      });

      const invoiceNumber = await mintDocumentNumber(tx, "invoice");
      const invoice = await tx.invoice.create({
        data: { number: invoiceNumber, orderId: order.id, subtotal: amount, total: amount, issuedAt: date },
      });
      await postJournalEntry(tx, {
        date,
        description: `Invoice ${invoice.number} issued`,
        sourceType: "invoice",
        sourceId: invoice.id,
        lines: [
          { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: entry.amount },
          { accountCode: ACCOUNTS.SALES_REVENUE, credit: entry.amount },
        ],
      });

      const receiptNumber = await mintDocumentNumber(tx, "receipt");
      const receipt = await tx.receipt.create({
        data: { number: receiptNumber, invoiceId: invoice.id, amount, method: "mpesa", reference: entry.receipt, paidAt: date },
      });
      await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaid: amount, status: "paid" } });
      await postJournalEntry(tx, {
        date,
        description: `Receipt ${receipt.number} against invoice`,
        sourceType: "receipt",
        sourceId: receipt.id,
        lines: [
          { accountCode: cashAccountForMethod("mpesa"), debit: entry.amount },
          { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, credit: entry.amount },
        ],
      });
      await logAdminAction(
        {
          action: "invoice.recordPayment",
          entityType: "invoice",
          entityId: invoice.id,
          summary: `Recorded payment of ${amount} against invoice ${invoice.number} (XPRIZE P&L import)`,
          metadata: { amount: entry.amount, method: "mpesa", reference: entry.receipt, source: "xprize_pl_statement.pdf" },
        },
        tx,
      );
    }, { timeout: 15000 });
    imported++;
  }

  revalidatePath("/admin/receipts");
  revalidatePath("/admin/orders");
  redirectWithSuccess(
    "/admin/receipts",
    imported > 0 ? `Imported ${imported} XPRIZE P&L revenue transaction(s).` : "XPRIZE P&L revenue already imported.",
  );
}

export async function sendReceiptEmail(receiptId: string): Promise<void> {
  await requireAdminSession();
  const receipt = await prisma.receipt.findUniqueOrThrow({
    where: { id: receiptId },
    include: { invoice: { include: { order: { include: { customer: true, items: true } } } } },
  });
  if (!isEmailConfigured) {
    redirectWithError(
      `/admin/orders/${receipt.invoice.orderId}`,
      "Email isn't configured — set RESEND_API_KEY and DOCUMENT_EMAIL_FROM.",
    );
  }
  if (!receipt.invoice.order.customer.email) {
    redirectWithError(`/admin/orders/${receipt.invoice.orderId}`, "Customer has no email on file.");
  }

  const pdfBuffer = await renderReceiptPdf(
    receipt,
    receipt.invoice,
    receipt.invoice.order.customer,
    receipt.invoice.order.items,
  );
  await sendReceiptEmailMessage(receipt, receipt.invoice.order.customer, pdfBuffer);

  revalidatePath(`/admin/orders/${receipt.invoice.orderId}`);
  redirectWithSuccess(`/admin/orders/${receipt.invoice.orderId}`, "Receipt emailed.");
}

const WHATSAPP_RECEIPT_TEMPLATE_SID = process.env.TWILIO_WHATSAPP_RECEIPT_TEMPLATE_SID;

export async function sendReceiptWhatsApp(receiptId: string): Promise<void> {
  await requireAdminSession();
  const receipt = await prisma.receipt.findUniqueOrThrow({
    where: { id: receiptId },
    include: { invoice: { include: { order: { include: { customer: true } } } } },
  });
  const orderPath = `/admin/orders/${receipt.invoice.orderId}`;

  if (!isWhatsAppSendConfigured || !WHATSAPP_RECEIPT_TEMPLATE_SID) {
    redirectWithError(
      orderPath,
      "WhatsApp sending isn't configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, and TWILIO_WHATSAPP_RECEIPT_TEMPLATE_SID.",
    );
  }
  const customer = receipt.invoice.order.customer;
  const to = customer.phone ? normalizeWhatsAppPhone(customer.phone) : null;
  if (!to) {
    redirectWithError(orderPath, "Customer has no WhatsApp-capable phone number on file.");
  }

  await sendWhatsAppTemplate(to, WHATSAPP_RECEIPT_TEMPLATE_SID, {
    "1": customer.name ?? "there",
    "2": receipt.number,
    "3": formatPrice(receipt.amount.toString(), receipt.invoice.order.currencyCode),
    "4": `${SITE_URL}/account/documents`,
  });
  await prisma.receipt.update({ where: { id: receiptId }, data: { whatsappSentAt: new Date() } });

  revalidatePath(orderPath);
  redirectWithSuccess(orderPath, "Receipt sent via WhatsApp.");
}

export async function voidInvoice(invoiceId: string): Promise<void> {
  await requireAdminSession();
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  if (Number(invoice.amountPaid) > 0) {
    redirectWithError(
      `/admin/orders/${invoice.orderId}`,
      "Can't void an invoice that has received payments — this system has no refund/credit-note concept yet. Contact your accountant for how to handle it.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "void", voidedAt: new Date() } });
    // Reverses the Dr Accounts Receivable / Cr Sales Revenue posted when the invoice was issued,
    // so a voided invoice no longer shows as phantom revenue or a phantom receivable.
    await postJournalEntry(tx, {
      date: new Date(),
      description: `Invoice ${invoice.number} voided`,
      sourceType: "invoice_void",
      sourceId: invoice.id,
      lines: [
        { accountCode: ACCOUNTS.SALES_REVENUE, debit: Number(invoice.total) },
        { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, credit: Number(invoice.total) },
      ],
    });
    await logAdminAction(
      {
        action: "invoice.void",
        entityType: "invoice",
        entityId: invoiceId,
        summary: `Voided invoice ${invoice.number}`,
      },
      tx,
    );
  });

  revalidatePath(`/admin/orders/${invoice.orderId}`);
  redirectWithSuccess(`/admin/orders/${invoice.orderId}`, "Invoice voided.");
}

export async function updateDeliveryNote(deliveryNoteId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const deliveryNote = await prisma.deliveryNote.findUniqueOrThrow({ where: { id: deliveryNoteId } });

  if (deliveryNote.status !== "pending") {
    redirectWithError(`/admin/orders/${deliveryNote.orderId}`, "Can't edit a delivery note that's already marked delivered.");
  }

  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const recipientPhone = String(formData.get("recipientPhone") ?? "").trim() || null;
  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim();
  const deliveryMethod = String(formData.get("deliveryMethod") ?? "").trim() || null;

  if (!recipientName || !deliveryAddress) {
    redirectWithError(`/admin/orders/${deliveryNote.orderId}`, "Recipient name and delivery address are required.");
  }

  await prisma.deliveryNote.update({
    where: { id: deliveryNoteId },
    data: { recipientName, recipientPhone, deliveryAddress, deliveryMethod },
  });

  revalidatePath(`/admin/orders/${deliveryNote.orderId}`);
  redirectWithSuccess(`/admin/orders/${deliveryNote.orderId}`, "Delivery note updated.");
}

async function deleteDeliveryNoteSilent(deliveryNoteId: string): Promise<{ orderId: string; number: string }> {
  const deliveryNote = await prisma.deliveryNote.findUniqueOrThrow({ where: { id: deliveryNoteId } });

  if (deliveryNote.status !== "pending") {
    throw new ActionGuardError(
      "Can't delete a delivery note that's already marked delivered.",
      `/admin/orders/${deliveryNote.orderId}`,
    );
  }

  await prisma.deliveryNote.delete({ where: { id: deliveryNoteId } });
  await logAdminAction({
    action: "deliveryNote.delete",
    entityType: "deliveryNote",
    entityId: deliveryNoteId,
    summary: `Deleted delivery note ${deliveryNote.number}`,
  });

  revalidatePath(`/admin/orders/${deliveryNote.orderId}`);
  return { orderId: deliveryNote.orderId, number: deliveryNote.number };
}

export async function deleteDeliveryNote(deliveryNoteId: string): Promise<void> {
  await requireAdminSession();
  try {
    const { orderId } = await deleteDeliveryNoteSilent(deliveryNoteId);
    redirectWithSuccess(`/admin/orders/${orderId}`, "Delivery note deleted.");
  } catch (error) {
    if (error instanceof ActionGuardError) redirectWithError(error.redirectPath, error.message);
    throw error;
  }
}

export async function createDeliveryNote(orderId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const recipientPhone = String(formData.get("recipientPhone") ?? "").trim() || null;
  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim();
  const deliveryMethod = String(formData.get("deliveryMethod") ?? "").trim() || null;

  if (!recipientName || !deliveryAddress) {
    redirectWithError(`/admin/orders/${orderId}/delivery-note/new`, "Recipient name and delivery address are required.");
  }

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "delivery_note");
    await tx.deliveryNote.create({
      data: { number, orderId, recipientName, recipientPhone, deliveryAddress, deliveryMethod },
    });
  });

  revalidatePath(`/admin/orders/${orderId}`);
  redirectWithSuccess(`/admin/orders/${orderId}`, "Delivery note created.");
}

export async function markDelivered(deliveryNoteId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const receivedBy = String(formData.get("receivedBy") ?? "").trim() || null;
  const riderId = String(formData.get("riderId") ?? "").trim() || null;
  const confirmPayment = formData.get("confirmPayment") === "on";

  const existing = await prisma.deliveryNote.findUniqueOrThrow({
    where: { id: deliveryNoteId },
    include: { order: { include: { invoice: true } } },
  });

  // Re-derive payment status server-side rather than trusting a client-submitted flag — the
  // internal Invoice is staff-entered bookkeeping that can drift from reality, so for Shopify
  // orders (e.g. Cash on Delivery, which stays financially Pending until cash is collected) the
  // live Shopify order is the real source of truth.
  const liveShopifyOrder =
    existing.order.source === "shopify" && existing.order.shopifyOrderId
      ? await getShopifyOrderById(existing.order.shopifyOrderId)
      : null;
  const paymentConfirmed =
    existing.order.source === "shopify"
      ? liveShopifyOrder?.displayFinancialStatus === "PAID"
      : existing.order.invoice?.status === "paid";

  if (!paymentConfirmed && !confirmPayment) {
    redirectWithError(
      `/admin/orders/${existing.orderId}`,
      "This order isn't confirmed as paid yet — check \"I confirm payment has actually been received\" before marking it delivered.",
    );
  }

  const note = await prisma.deliveryNote.update({
    where: { id: deliveryNoteId },
    data: { status: "delivered", receivedBy, riderId, deliveredAt: new Date() },
  });

  if (!paymentConfirmed) {
    await logAdminAction({
      action: "deliveryNote.markDelivered.unconfirmedPayment",
      entityType: "deliveryNote",
      entityId: note.id,
      summary: `Marked delivered for order ${existing.orderId} without confirmed payment (Shopify status: ${liveShopifyOrder?.displayFinancialStatus ?? "n/a"})`,
    });
  }

  revalidatePath(`/admin/orders/${note.orderId}`);
  redirectWithSuccess(`/admin/orders/${note.orderId}`, "Marked as delivered.");
}

async function sendDeliveryNoteEmailSilent(deliveryNoteId: string): Promise<{ orderId: string }> {
  const note = await prisma.deliveryNote.findUniqueOrThrow({
    where: { id: deliveryNoteId },
    include: { order: { include: { customer: true, items: true } } },
  });
  if (!isEmailConfigured) {
    throw new ActionGuardError(
      "Email isn't configured — set RESEND_API_KEY and DOCUMENT_EMAIL_FROM.",
      `/admin/orders/${note.orderId}`,
    );
  }
  if (!note.order.customer.email) {
    throw new ActionGuardError("Customer has no email on file.", `/admin/orders/${note.orderId}`);
  }

  const pdfBuffer = await renderDeliveryNotePdf(note, note.order, note.order.items);
  await sendDeliveryNoteEmailMessage(note, note.order.customer, pdfBuffer);

  revalidatePath(`/admin/orders/${note.orderId}`);
  return { orderId: note.orderId };
}

export async function sendDeliveryNoteEmail(deliveryNoteId: string): Promise<void> {
  await requireAdminSession();
  try {
    const { orderId } = await sendDeliveryNoteEmailSilent(deliveryNoteId);
    redirectWithSuccess(`/admin/orders/${orderId}`, "Delivery note emailed.");
  } catch (error) {
    if (error instanceof ActionGuardError) redirectWithError(error.redirectPath, error.message);
    throw error;
  }
}

export type BulkDocumentType = "invoice" | "estimate" | "delivery-note";

/**
 * Bulk delete/email reuse each type's existing single-item action (with its
 * existing guards — e.g. can't delete a paid invoice) one id at a time, so an
 * ineligible or already-gone row is simply skipped rather than failing the
 * whole batch. Sequential, not Promise.all, so a run of bulk emails doesn't
 * hammer the email provider with a burst of concurrent sends.
 */
async function bulkRunPerType(
  type: BulkDocumentType,
  ids: string[],
  runners: {
    invoice: (id: string) => Promise<unknown>;
    estimate: (id: string) => Promise<unknown>;
    "delivery-note": (id: string) => Promise<unknown>;
  },
): Promise<{ succeeded: number; skipped: number }> {
  let succeeded = 0;
  for (const id of ids) {
    try {
      await runners[type](id);
      succeeded++;
    } catch {
      // Ineligible (guard threw) or already gone — counted as skipped, not a hard failure.
    }
  }
  return { succeeded, skipped: ids.length - succeeded };
}

export async function bulkDeleteDocuments(type: BulkDocumentType, formData: FormData): Promise<void> {
  await requireAdminSession();
  const ids = formData.getAll("ids").map(String);

  const { succeeded, skipped } = await bulkRunPerType(type, ids, {
    invoice: deleteInvoiceSilent,
    estimate: deleteEstimateSilent,
    "delivery-note": deleteDeliveryNoteSilent,
  });

  revalidatePath("/admin/documents");
  redirectWithSuccess(
    `/admin/documents?type=${type}`,
    `Deleted ${succeeded} document(s)${skipped > 0 ? `, skipped ${skipped} ineligible` : ""}.`,
  );
}

export async function bulkEmailDocuments(type: BulkDocumentType, formData: FormData): Promise<void> {
  await requireAdminSession();
  const ids = formData.getAll("ids").map(String);

  const { succeeded, skipped } = await bulkRunPerType(type, ids, {
    invoice: sendInvoiceEmailSilent,
    estimate: sendEstimateEmailSilent,
    "delivery-note": sendDeliveryNoteEmailSilent,
  });

  revalidatePath("/admin/documents");
  redirectWithSuccess(
    `/admin/documents?type=${type}`,
    `Emailed ${succeeded} document(s)${skipped > 0 ? `, skipped ${skipped}` : ""}.`,
  );
}
