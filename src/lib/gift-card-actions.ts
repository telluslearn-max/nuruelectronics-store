"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { getShopifyOrderById } from "./shopify/admin-api";
import { isEmailConfigured, sendGiftCardCodeEmail, sendOpsAlertEmail } from "./email";
import { isWhatsAppCloudConfigured, sendGiftCardCodeWhatsApp } from "./whatsapp-cloud-api";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";
import { logAdminAction } from "./audit-log";
import { getGiftCardRedeemCode, isReloadlyConfigured, placeGiftCardOrder } from "./reloadly/client";
import { MINIMUM_MARKUP_PERCENT, clampMarkupPercent } from "./gift-card-pricing";

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

export async function createGiftCardOffering(formData: FormData): Promise<void> {
  await requireAdminSession();

  const reloadlyProductId = Number(formData.get("reloadlyProductId"));
  const displayName = String(formData.get("displayName") ?? "").trim();
  const category = String(formData.get("category") ?? "other").trim() || "other";
  const reloadlyCountryCode = String(formData.get("reloadlyCountryCode") ?? "").trim();
  const reloadlyCurrencyCode = String(formData.get("reloadlyCurrencyCode") ?? "").trim();
  const denominationType = String(formData.get("denominationType") ?? "").trim();
  const fixedDenominationsRaw = String(formData.get("fixedDenominations") ?? "").trim();
  const minDenominationRaw = String(formData.get("minDenomination") ?? "").trim();
  const maxDenominationRaw = String(formData.get("maxDenomination") ?? "").trim();
  const markupPercent = clampMarkupPercent(Number(formData.get("markupPercent")) || MINIMUM_MARKUP_PERCENT);

  if (!reloadlyProductId || !displayName || !reloadlyCountryCode || !reloadlyCurrencyCode || !denominationType) {
    redirectWithError("/admin/gift-cards", "Missing required fields for the offering.");
  }

  const existing = await prisma.giftCardOffering.findUnique({ where: { reloadlyProductId } });
  if (existing) {
    redirectWithError("/admin/gift-cards", "That Reloadly product is already published as a storefront offering.");
  }

  const fixedDenominations = fixedDenominationsRaw
    ? fixedDenominationsRaw
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v))
    : [];

  const offering = await prisma.giftCardOffering.create({
    data: {
      reloadlyProductId,
      displayName,
      category,
      reloadlyCountryCode,
      reloadlyCurrencyCode,
      denominationType,
      fixedDenominations,
      minDenomination: minDenominationRaw ? Number(minDenominationRaw) : null,
      maxDenomination: maxDenominationRaw ? Number(maxDenominationRaw) : null,
      markupPercent,
      published: true,
    },
  });

  await logAdminAction({
    action: "gift_card_offering.create",
    entityType: "giftCardOffering",
    entityId: offering.id,
    summary: `Published storefront offering "${displayName}" (Reloadly product #${reloadlyProductId})`,
  });

  revalidatePath("/admin/gift-cards");
  redirectWithSuccess("/admin/gift-cards", "Offering published to the storefront.");
}

export async function updateGiftCardOffering(offeringId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const markupPercentRaw = Number(formData.get("markupPercent"));
  const markupPercent = clampMarkupPercent(Number.isFinite(markupPercentRaw) ? markupPercentRaw : MINIMUM_MARKUP_PERCENT);
  const published = formData.get("published") === "on";

  const offering = await prisma.giftCardOffering.update({
    where: { id: offeringId },
    data: { markupPercent, published },
  });

  await logAdminAction({
    action: "gift_card_offering.update",
    entityType: "giftCardOffering",
    entityId: offering.id,
    summary: `Updated storefront offering "${offering.displayName}" (markup ${markupPercent}%, published: ${published})`,
  });

  revalidatePath("/admin/gift-cards");
  redirectWithSuccess("/admin/gift-cards", "Offering updated.");
}

export async function deleteGiftCardOffering(offeringId: string): Promise<void> {
  await requireAdminSession();

  const offering = await prisma.giftCardOffering.findUniqueOrThrow({ where: { id: offeringId } });
  try {
    await prisma.giftCardOffering.delete({ where: { id: offeringId } });
  } catch {
    redirectWithError("/admin/gift-cards", "Can't delete this offering — it already has checkouts against it. Unpublish it instead.");
  }

  await logAdminAction({
    action: "gift_card_offering.delete",
    entityType: "giftCardOffering",
    entityId: offering.id,
    summary: `Removed storefront offering "${offering.displayName}"`,
  });

  revalidatePath("/admin/gift-cards");
  redirectWithSuccess("/admin/gift-cards", "Offering removed.");
}

export type FulfillmentResult = { status: "completed" | "failed"; errorMessage?: string };

/**
 * Shared core: places the Reloadly order, stores the redeem code, and best-effort notifies the customer
 * by email/WhatsApp. This is the only place a Reloadly gift card order is actually placed — both the
 * admin-triggered action below and the automatic M-Pesa checkout confirmation
 * (src/lib/gift-card-checkout-actions.ts) call this instead of duplicating the logic.
 *
 * `reloadlyUnitPrice` is the amount to charge Reloadly, in the gift card's own currency (e.g. USD) — NOT
 * the customer-facing KES retail price, which has FX conversion and markup baked in and would wildly
 * overpay/underpay Reloadly if passed here by mistake. When omitted, falls back to the OrderItem's own
 * `unitPrice` (the admin-triggered Shopify-mapped flow has no separate markup/FX layer, so its Shopify
 * variant price is assumed to already be the Reloadly-currency amount).
 */
export async function runGiftCardFulfillment(
  orderItemId: string,
  reloadlyProductId: number,
  reloadlyUnitPrice?: number,
): Promise<FulfillmentResult> {
  const item = await prisma.orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    include: { order: { include: { customer: true } } },
  });

  await prisma.giftCardFulfillment.upsert({
    where: { orderItemId },
    create: { orderItemId, reloadlyProductId, status: "pending" },
    update: { status: "pending", errorMessage: null },
  });

  let fulfillment;
  try {
    const order = await placeGiftCardOrder({
      productId: reloadlyProductId,
      quantity: item.quantity,
      unitPrice: reloadlyUnitPrice ?? Number(item.unitPrice),
      // Deterministic from the line item, so a re-attempt after a partial failure reuses the same
      // Reloadly order instead of placing (and paying for) a duplicate one.
      customIdentifier: orderItemId,
    });
    const codes = await getGiftCardRedeemCode(order.transactionId);
    const code = codes[0];
    if (!code) throw new Error("Reloadly didn't return a redeem code for this order.");

    fulfillment = await prisma.giftCardFulfillment.update({
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error placing the Reloadly order.";
    await prisma.giftCardFulfillment.update({ where: { orderItemId }, data: { status: "failed", errorMessage: message } });
    await logAdminAction({
      action: "gift_card.fulfillment_failed",
      entityType: "giftCardFulfillment",
      entityId: orderItemId,
      summary: `Reloadly order failed for order ${item.orderId}: ${message}`,
    });
    try {
      await sendOpsAlertEmail(
        "Gift card fulfillment failed — customer paid, code not delivered",
        `<p>Order ${item.orderId} (item ${orderItemId}): ${message}</p><p>Check /admin/orders/${item.orderId} — retry the redemption or process a manual refund.</p>`,
      );
    } catch (alertError) {
      console.error("[gift-card] ops alert email failed:", alertError);
    }
    return { status: "failed", errorMessage: message };
  }

  await logAdminAction({
    action: "gift_card.fulfilled",
    entityType: "giftCardFulfillment",
    entityId: fulfillment.id,
    summary: `Sourced a gift card from Reloadly for order ${item.orderId}`,
  });

  // Notification failures must never flip a successful redemption to "failed" — kept in their own
  // try/catch, separate from the Reloadly-order-placement block above.
  try {
    if (isEmailConfigured && item.order.customer.email) {
      await sendGiftCardCodeEmail(fulfillment, item.order.customer);
    }
  } catch (notifyError) {
    console.error("[gift-card] email notification failed:", notifyError);
  }
  try {
    if (isWhatsAppCloudConfigured && item.order.customer.phone) {
      await sendGiftCardCodeWhatsApp(item.order.customer.phone, {
        offeringName: item.title,
        cardNumber: fulfillment.cardNumber ?? "",
        pinCode: fulfillment.pinCode,
      });
    }
  } catch (notifyError) {
    console.error("[gift-card] WhatsApp notification failed:", notifyError);
  }

  return { status: "completed" };
}

export async function fulfillGiftCardItem(orderItemId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const confirmPayment = formData.get("confirmPayment") === "on";

  const item = await prisma.orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    include: { order: { include: { invoice: true } }, giftCardFulfillment: true },
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

  const result = await runGiftCardFulfillment(orderItemId, mapping.reloadlyProductId);

  revalidatePath(orderPage);
  if (result.status === "failed") {
    redirectWithError(orderPage, `Gift card order failed: ${result.errorMessage}`);
  }
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
