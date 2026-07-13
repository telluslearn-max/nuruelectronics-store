"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { generateAccessToken, mintDocumentNumber } from "./documents";
import { getShopifyOrderById } from "./shopify/admin-api";
import { sendDeliveryNoteEmail as sendDeliveryNoteEmailMessage, sendEstimateEmail as sendEstimateEmailMessage, sendInvoiceEmail as sendInvoiceEmailMessage, sendReceiptEmail as sendReceiptEmailMessage } from "./email";
import { renderDeliveryNotePdf, renderEstimatePdf, renderInvoicePdf, renderReceiptPdf } from "./pdf/render";
import type { PaymentMethod } from "@prisma/client";

function parseLineItems(formData: FormData): { title: string; quantity: number; unitPrice: string; lineTotal: string }[] {
  const items: { title: string; quantity: number; unitPrice: string; lineTotal: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const title = formData.get(`item_title_${i}`);
    const quantity = formData.get(`item_qty_${i}`);
    const unitPrice = formData.get(`item_price_${i}`);
    if (!title || String(title).trim() === "") continue;
    const qty = Number(quantity) || 0;
    const price = Number(unitPrice) || 0;
    if (qty <= 0) continue;
    items.push({
      title: String(title).trim(),
      quantity: qty,
      unitPrice: price.toFixed(2),
      lineTotal: (qty * price).toFixed(2),
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
  const items = parseLineItems(formData);

  if (!email || items.length === 0) {
    throw new Error("A customer email and at least one line item are required.");
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

  revalidatePath("/admin");
  redirect(`/admin/orders/${order.id}`);
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
    throw new Error("Shopify order not found.");
  }

  const email = shopifyOrder.customer?.email?.toLowerCase() ?? null;
  if (!email) {
    throw new Error("This Shopify order has no customer email on file.");
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

  revalidatePath("/admin");
  redirect(`/admin/orders/${order.id}`);
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
      },
    });
  });

  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/admin/orders/${orderId}`);
}

export async function sendEstimateEmail(estimateId: string): Promise<void> {
  await requireAdminSession();
  const estimate = await prisma.estimate.findUniqueOrThrow({
    where: { id: estimateId },
    include: { order: { include: { customer: true, items: true } } },
  });
  if (!estimate.order.customer.email) throw new Error("Customer has no email on file.");

  const pdfBuffer = await renderEstimatePdf(estimate, estimate.order, estimate.order.customer, estimate.order.items);
  await sendEstimateEmailMessage(estimate, estimate.order.customer, pdfBuffer);

  await prisma.estimate.update({
    where: { id: estimateId },
    data: { status: estimate.status === "draft" ? "sent" : estimate.status, sentAt: new Date() },
  });

  revalidatePath(`/admin/orders/${estimate.orderId}`);
}

export async function createInvoiceFromEstimate(estimateId: string): Promise<void> {
  await requireAdminSession();
  const estimate = await prisma.estimate.findUniqueOrThrow({ where: { id: estimateId } });

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "invoice");
    await tx.invoice.create({
      data: {
        number,
        orderId: estimate.orderId,
        subtotal: estimate.subtotal,
        taxTotal: estimate.taxTotal,
        shippingTotal: estimate.shippingTotal,
        discountTotal: estimate.discountTotal,
        total: estimate.total,
        issuedAt: new Date(),
      },
    });
  });

  revalidatePath(`/admin/orders/${estimate.orderId}`);
  redirect(`/admin/orders/${estimate.orderId}`);
}

export async function createInvoice(orderId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const taxTotal = Number(formData.get("taxTotal") ?? 0) || 0;
  const shippingTotal = Number(formData.get("shippingTotal") ?? 0) || 0;
  const discountTotal = Number(formData.get("discountTotal") ?? 0) || 0;
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const subtotal = sumItems(order.items);
  const total = subtotal + taxTotal + shippingTotal - discountTotal;

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "invoice");
    await tx.invoice.create({
      data: {
        number,
        orderId,
        subtotal: subtotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        shippingTotal: shippingTotal.toFixed(2),
        discountTotal: discountTotal.toFixed(2),
        total: total.toFixed(2),
        dueAt,
        issuedAt: new Date(),
      },
    });
  });

  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/admin/orders/${orderId}`);
}

export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  await requireAdminSession();
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { order: { include: { customer: true, items: true } } },
  });
  if (!invoice.order.customer.email) throw new Error("Customer has no email on file.");

  const pdfBuffer = await renderInvoicePdf(invoice, invoice.order, invoice.order.customer, invoice.order.items);
  await sendInvoiceEmailMessage(invoice, invoice.order.customer, pdfBuffer);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: invoice.status === "draft" ? "sent" : invoice.status, sentAt: new Date() },
  });

  revalidatePath(`/admin/orders/${invoice.orderId}`);
}

function nextInvoiceStatus(total: string, amountPaid: number): "sent" | "partially_paid" | "paid" {
  if (amountPaid <= 0) return "sent";
  if (amountPaid >= Number(total)) return "paid";
  return "partially_paid";
}

export async function recordPayment(invoiceId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const amount = Number(formData.get("amount") ?? 0) || 0;
  const method = String(formData.get("method")) as PaymentMethod;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const paidAtRaw = String(formData.get("paidAt") ?? "");
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();

  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "receipt");
    await tx.receipt.create({
      data: { number, invoiceId, amount: amount.toFixed(2), method, reference, paidAt },
    });

    const newAmountPaid = Number(invoice.amountPaid) + amount;
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid.toFixed(2),
        status: nextInvoiceStatus(invoice.total.toString(), newAmountPaid),
      },
    });
  });

  revalidatePath(`/admin/orders/${invoice.orderId}`);
}

export async function sendReceiptEmail(receiptId: string): Promise<void> {
  await requireAdminSession();
  const receipt = await prisma.receipt.findUniqueOrThrow({
    where: { id: receiptId },
    include: { invoice: { include: { order: { include: { customer: true } } } } },
  });
  if (!receipt.invoice.order.customer.email) throw new Error("Customer has no email on file.");

  const pdfBuffer = await renderReceiptPdf(receipt, receipt.invoice, receipt.invoice.order.customer);
  await sendReceiptEmailMessage(receipt, receipt.invoice.order.customer, pdfBuffer);

  revalidatePath(`/admin/orders/${receipt.invoice.orderId}`);
}

export async function voidInvoice(invoiceId: string): Promise<void> {
  await requireAdminSession();
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "void", voidedAt: new Date() },
  });
  revalidatePath(`/admin/orders/${invoice.orderId}`);
}

export async function createDeliveryNote(orderId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const recipientPhone = String(formData.get("recipientPhone") ?? "").trim() || null;
  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim();
  const deliveryMethod = String(formData.get("deliveryMethod") ?? "").trim() || null;

  if (!recipientName || !deliveryAddress) {
    throw new Error("Recipient name and delivery address are required.");
  }

  await prisma.$transaction(async (tx) => {
    const number = await mintDocumentNumber(tx, "delivery_note");
    await tx.deliveryNote.create({
      data: { number, orderId, recipientName, recipientPhone, deliveryAddress, deliveryMethod },
    });
  });

  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/admin/orders/${orderId}`);
}

export async function markDelivered(deliveryNoteId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const receivedBy = String(formData.get("receivedBy") ?? "").trim() || null;

  const note = await prisma.deliveryNote.update({
    where: { id: deliveryNoteId },
    data: { status: "delivered", receivedBy, deliveredAt: new Date() },
  });

  revalidatePath(`/admin/orders/${note.orderId}`);
}

export async function sendDeliveryNoteEmail(deliveryNoteId: string): Promise<void> {
  await requireAdminSession();
  const note = await prisma.deliveryNote.findUniqueOrThrow({
    where: { id: deliveryNoteId },
    include: { order: { include: { customer: true, items: true } } },
  });
  if (!note.order.customer.email) throw new Error("Customer has no email on file.");

  const pdfBuffer = await renderDeliveryNotePdf(note, note.order, note.order.items);
  await sendDeliveryNoteEmailMessage(note, note.order.customer, pdfBuffer);

  revalidatePath(`/admin/orders/${note.orderId}`);
}
