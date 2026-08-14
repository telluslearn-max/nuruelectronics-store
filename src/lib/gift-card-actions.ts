"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { getShopifyOrderById } from "./shopify/admin-api";
import { isEmailConfigured, sendGiftCardCodeEmail } from "./email";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";
import { logAdminAction } from "./audit-log";
import { getGiftCardRedeemCode, isReloadlyConfigured, placeGiftCardOrder } from "./reloadly/client";

export async function createGiftCardMapping(formData: FormData): Promise<void> {
  await requireAdminSession();

  const shopifyVariantId = String(formData.get("shopifyVariantId") ?? "").trim();
  const shopifyProductTitle = String(formData.get("shopifyProductTitle") ?? "").trim();
  const reloadlyProductId = Number(formData.get("reloadlyProductId"));
  const reloadlyProductName = String(formData.get("reloadlyProductName") ?? "").trim();
  const reloadlyCountryCode = String(formData.get("reloadlyCountryCode") ?? "").trim();

  if (!shopifyVariantId || !shopifyProductTitle || !reloadlyProductId || !reloadlyProductName) {
    redirectWithError("/admin/gift-cards", "A Shopify variant ID, product title, and Reloadly product are required.");
  }

  const existing = await prisma.giftCardProductMapping.findUnique({ where: { shopifyVariantId } });
  if (existing) {
    redirectWithError("/admin/gift-cards", "That Shopify variant already has a Reloadly mapping.");
  }

  const mapping = await prisma.giftCardProductMapping.create({
    data: { shopifyVariantId, shopifyProductTitle, reloadlyProductId, reloadlyProductName, reloadlyCountryCode },
  });

  await logAdminAction({
    action: "gift_card_mapping.create",
    entityType: "giftCardProductMapping",
    entityId: mapping.id,
    summary: `Mapped Shopify variant ${shopifyVariantId} to Reloadly product "${reloadlyProductName}"`,
  });

  revalidatePath("/admin/gift-cards");
  redirectWithSuccess("/admin/gift-cards", "Mapping saved.");
}

export async function deleteGiftCardMapping(mappingId: string): Promise<void> {
  await requireAdminSession();

  const mapping = await prisma.giftCardProductMapping.findUniqueOrThrow({ where: { id: mappingId } });
  await prisma.giftCardProductMapping.delete({ where: { id: mappingId } });

  await logAdminAction({
    action: "gift_card_mapping.delete",
    entityType: "giftCardProductMapping",
    entityId: mapping.id,
    summary: `Removed Reloadly mapping for Shopify variant ${mapping.shopifyVariantId}`,
  });

  revalidatePath("/admin/gift-cards");
  redirectWithSuccess("/admin/gift-cards", "Mapping removed.");
}

export async function fulfillGiftCardItem(orderItemId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const confirmPayment = formData.get("confirmPayment") === "on";

  const item = await prisma.orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    include: { order: { include: { customer: true, invoice: true } }, giftCardFulfillment: true },
  });
  const orderPage = `/admin/orders/${item.orderId}`;

  if (item.giftCardFulfillment?.status === "completed") {
    redirectWithSuccess(orderPage, "This item's gift card was already fulfilled.");
  }

  if (!isReloadlyConfigured) {
    redirectWithError(orderPage, "Reloadly isn't configured — set RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET.");
  }

  if (!item.variantId) {
    redirectWithError(orderPage, "This line item has no Shopify variant, so it can't be matched to a gift card product.");
  }

  const mapping = await prisma.giftCardProductMapping.findUnique({ where: { shopifyVariantId: item.variantId } });
  if (!mapping) {
    redirectWithError(orderPage, "No Reloadly product is mapped to this item yet — add one on /admin/gift-cards.");
  }

  // Re-derive payment status server-side rather than trusting the client — same guard as
  // markDelivered, since sourcing a real gift card code costs real money against the Reloadly
  // balance and must not happen before payment is actually confirmed.
  const liveShopifyOrder =
    item.order.source === "shopify" && item.order.shopifyOrderId ? await getShopifyOrderById(item.order.shopifyOrderId) : null;
  const paymentConfirmed =
    item.order.source === "shopify" ? liveShopifyOrder?.displayFinancialStatus === "PAID" : item.order.invoice?.status === "paid";

  if (!paymentConfirmed && !confirmPayment) {
    redirectWithError(
      orderPage,
      "This order isn't confirmed as paid yet — check \"I confirm payment has actually been received\" before sourcing a gift card.",
    );
  }

  if (!paymentConfirmed) {
    await logAdminAction({
      action: "gift_card.fulfill.unconfirmedPayment",
      entityType: "orderItem",
      entityId: orderItemId,
      summary: `Sourced a gift card for order ${item.orderId} without confirmed payment (Shopify status: ${liveShopifyOrder?.displayFinancialStatus ?? "n/a"})`,
    });
  }

  await prisma.giftCardFulfillment.upsert({
    where: { orderItemId },
    create: { orderItemId, reloadlyProductId: mapping.reloadlyProductId, status: "pending" },
    update: { status: "pending", errorMessage: null },
  });

  try {
    const order = await placeGiftCardOrder({
      productId: mapping.reloadlyProductId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      // Deterministic from the line item, so a re-click after a partial failure reuses the same
      // Reloadly order instead of placing (and paying for) a duplicate one.
      customIdentifier: orderItemId,
    });
    const codes = await getGiftCardRedeemCode(order.transactionId);
    const code = codes[0];
    if (!code) throw new Error("Reloadly didn't return a redeem code for this order.");

    const fulfillment = await prisma.giftCardFulfillment.update({
      where: { orderItemId },
      data: {
        status: "completed",
        reloadlyTransactionId: String(order.transactionId),
        cardNumber: code.cardNumber,
        pinCode: code.pinCode,
        amount: order.amount,
        currencyCode: order.currencyCode,
        deliveredAt: new Date(),
        errorMessage: null,
      },
    });

    await logAdminAction({
      action: "gift_card.fulfilled",
      entityType: "giftCardFulfillment",
      entityId: fulfillment.id,
      summary: `Sourced a gift card from Reloadly for order ${item.orderId}`,
    });

    if (isEmailConfigured && item.order.customer.email) {
      await sendGiftCardCodeEmail(fulfillment, item.order.customer);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error placing the Reloadly order.";
    await prisma.giftCardFulfillment.update({ where: { orderItemId }, data: { status: "failed", errorMessage: message } });
    await logAdminAction({
      action: "gift_card.fulfillment_failed",
      entityType: "giftCardFulfillment",
      entityId: orderItemId,
      summary: `Reloadly order failed for order ${item.orderId}: ${message}`,
    });
    revalidatePath(orderPage);
    redirectWithError(orderPage, `Gift card order failed: ${message}`);
  }

  revalidatePath(orderPage);
  redirectWithSuccess(orderPage, "Gift card sourced and emailed to the customer.");
}

export async function resendGiftCardCodeEmail(fulfillmentId: string): Promise<void> {
  await requireAdminSession();

  const fulfillment = await prisma.giftCardFulfillment.findUniqueOrThrow({
    where: { id: fulfillmentId },
    include: { orderItem: { include: { order: { include: { customer: true } } } } },
  });
  const orderPage = `/admin/orders/${fulfillment.orderItem.orderId}`;

  if (fulfillment.status !== "completed") {
    redirectWithError(orderPage, "This gift card hasn't been fulfilled yet.");
  }
  if (!isEmailConfigured) {
    redirectWithError(orderPage, "Email isn't configured — set RESEND_API_KEY and DOCUMENT_EMAIL_FROM.");
  }

  await sendGiftCardCodeEmail(fulfillment, fulfillment.orderItem.order.customer);

  await logAdminAction({
    action: "gift_card.email_resent",
    entityType: "giftCardFulfillment",
    entityId: fulfillment.id,
    summary: `Re-sent gift card code email for order ${fulfillment.orderItem.orderId}`,
  });

  redirectWithSuccess(orderPage, "Gift card code re-sent.");
}
