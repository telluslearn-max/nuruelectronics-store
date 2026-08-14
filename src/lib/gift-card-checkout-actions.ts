"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";
import { logAdminAction } from "./audit-log";
import { mintDocumentNumber } from "./documents";
import { ACCOUNTS, cashAccountForMethod, postJournalEntry } from "./ledger";
import { runGiftCardFulfillment } from "./gift-card-actions";
import { getSettings } from "./settings";
import { priceOfferingInKes } from "./gift-card-pricing";
import { normalizeKenyanPhone } from "./phone";

const CHECKOUT_VALIDITY_HOURS = 48;

function generateCheckoutCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

/**
 * Starts a storefront gift card checkout: locks in today's KES price (FX rate + markup) and creates a
 * pending GiftCardCheckout with a payment reference for the customer to type when paying NCBA's Paybill.
 * No external API call happens here — there's no push to trigger, so this is just a DB write.
 */
export async function startGiftCardCheckout(formData: FormData): Promise<void> {
  const offeringId = String(formData.get("offeringId") ?? "").trim();
  const denominationAmount = Number(formData.get("denominationAmount"));
  const customerEmail = String(formData.get("customerEmail") ?? "").trim().toLowerCase();
  const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();

  const offering = await prisma.giftCardOffering.findUnique({ where: { id: offeringId } });
  if (!offering || !offering.published) {
    redirect("/gift-cards");
  }

  const backToOffering = (message: string): never => {
    redirect(`/gift-cards/${offering.category}/${offering.id}?error=${encodeURIComponent(message)}`);
  };

  if (!denominationAmount || denominationAmount <= 0) {
    backToOffering("Choose a valid amount.");
  }
  if (offering.denominationType === "FIXED" && !offering.fixedDenominations.some((d) => Number(d) === denominationAmount)) {
    backToOffering("That amount isn't offered for this gift card.");
  }
  if (
    offering.denominationType === "RANGE" &&
    (denominationAmount < Number(offering.minDenomination) || denominationAmount > Number(offering.maxDenomination))
  ) {
    backToOffering("That amount is outside the allowed range for this gift card.");
  }
  if (!customerEmail) {
    backToOffering("An email address is required so we can send your code.");
  }
  const normalizedPhone = normalizeKenyanPhone(customerPhoneRaw);
  if (!normalizedPhone) {
    backToOffering("Enter a valid Kenyan M-Pesa phone number.");
    return;
  }

  const settings = await getSettings();
  let priceKes: number;
  try {
    priceKes = priceOfferingInKes(offering, denominationAmount, settings);
  } catch (error) {
    backToOffering(error instanceof Error ? error.message : "Couldn't price this gift card right now — try again shortly.");
    return;
  }

  const checkout = await prisma.giftCardCheckout.create({
    data: {
      offeringId: offering.id,
      denominationAmount,
      priceKes,
      customerEmail,
      customerPhone: normalizedPhone,
      checkoutCode: generateCheckoutCode(),
    },
  });

  redirect(`/gift-cards/checkout/${checkout.id}`);
}

export type ConfirmGiftCardCheckoutResult =
  | { status: "confirmed" }
  | { status: "already_paid" }
  | { status: "expired" };

/**
 * Confirms a GiftCardCheckout as paid and runs the shared bookkeeping + fulfillment pipeline. Called from
 * both the NCBA Loop webhook (src/app/api/ncba-loop/webhook/route.ts) and the admin manual-override
 * action — the only place a checkout transitions to "paid", so there's exactly one code path that touches
 * money, not several to keep in sync.
 */
export async function confirmGiftCardCheckoutPaid(
  checkoutId: string,
  input: { mpesaReceiptNumber: string; confirmedVia: "ncba_loop" | "admin_manual" },
): Promise<ConfirmGiftCardCheckoutResult> {
  const checkout = await prisma.giftCardCheckout.findUniqueOrThrow({
    where: { id: checkoutId },
    include: { offering: true },
  });

  if (checkout.status === "paid") return { status: "already_paid" };

  const ageHours = (Date.now() - checkout.createdAt.getTime()) / (1000 * 60 * 60);
  if (checkout.status === "expired" || ageHours > CHECKOUT_VALIDITY_HOURS) {
    if (checkout.status === "pending") {
      await prisma.giftCardCheckout.update({ where: { id: checkoutId }, data: { status: "expired" } });
    }
    return { status: "expired" };
  }

  const orderItemId = await prisma.$transaction(async (tx) => {
    // Atomic claim — NCBA Loop can retry-deliver a webhook, and the admin override could race with it.
    // If this doesn't match (someone else already confirmed it), nothing else in this callback runs.
    const claimed = await tx.giftCardCheckout.updateMany({
      where: { id: checkoutId, status: "pending" },
      data: { status: "paid", confirmedVia: input.confirmedVia, mpesaReceiptNumber: input.mpesaReceiptNumber },
    });
    if (claimed.count === 0) return null;

    const customer = await tx.customer.upsert({
      where: { email: checkout.customerEmail },
      create: { email: checkout.customerEmail, phone: checkout.customerPhone },
      update: { phone: checkout.customerPhone },
    });

    const order = await tx.order.create({
      data: {
        source: "mpesa_giftcard",
        currencyCode: "KES",
        customerId: customer.id,
        items: {
          create: [
            {
              title: `${checkout.offering.displayName} — ${checkout.denominationAmount} ${checkout.offering.reloadlyCurrencyCode}`,
              quantity: 1,
              unitPrice: checkout.priceKes,
              lineTotal: checkout.priceKes,
            },
          ],
        },
      },
      include: { items: true },
    });
    const orderItem = order.items[0];

    const invoiceNumber = await mintDocumentNumber(tx, "invoice");
    const invoice = await tx.invoice.create({
      data: {
        number: invoiceNumber,
        orderId: order.id,
        status: "paid",
        subtotal: checkout.priceKes,
        total: checkout.priceKes,
        amountPaid: checkout.priceKes,
        issuedAt: new Date(),
      },
    });
    await postJournalEntry(tx, {
      date: new Date(),
      description: `Invoice ${invoice.number} issued`,
      sourceType: "invoice",
      sourceId: invoice.id,
      lines: [
        { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: Number(invoice.total) },
        { accountCode: ACCOUNTS.SALES_REVENUE, credit: Number(invoice.total) },
      ],
    });

    const receiptNumber = await mintDocumentNumber(tx, "receipt");
    const receipt = await tx.receipt.create({
      data: {
        number: receiptNumber,
        invoiceId: invoice.id,
        amount: checkout.priceKes,
        method: "mpesa",
        reference: input.mpesaReceiptNumber,
        paidAt: new Date(),
      },
    });
    await postJournalEntry(tx, {
      date: new Date(),
      description: `Receipt ${receipt.number} against invoice`,
      sourceType: "receipt",
      sourceId: receipt.id,
      lines: [
        { accountCode: cashAccountForMethod("mpesa"), debit: Number(receipt.amount) },
        { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, credit: Number(receipt.amount) },
      ],
    });

    await tx.giftCardCheckout.update({ where: { id: checkoutId }, data: { orderId: order.id } });

    return orderItem.id;
  });

  if (!orderItemId) return { status: "already_paid" };

  // Outside the transaction so a slow Reloadly call doesn't hold the DB transaction open. Reloadly is
  // charged in its own currency (denominationAmount), not the KES retail price (priceKes) — those
  // diverge once FX conversion and markup are applied.
  await runGiftCardFulfillment(orderItemId, checkout.offering.reloadlyProductId, Number(checkout.denominationAmount));

  return { status: "confirmed" };
}

/**
 * The ultimate safety net (§5b): a staff member confirms a payment by hand — from a customer's
 * screenshot/WhatsApp message, or an unmatched-payment alert from the NCBA Loop webhook — so a paying
 * customer is never permanently stuck even if the automated path is down or misconfigured.
 */
export async function markGiftCardCheckoutPaidByAdmin(checkoutId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const mpesaReceiptNumber = String(formData.get("mpesaReceiptNumber") ?? "").trim();
  if (!mpesaReceiptNumber) {
    redirectWithError("/admin/gift-card-checkouts", "An M-Pesa receipt code is required.");
  }

  const result = await confirmGiftCardCheckoutPaid(checkoutId, { mpesaReceiptNumber, confirmedVia: "admin_manual" });

  await logAdminAction({
    action: "gift_card_checkout.manual_confirm",
    entityType: "giftCardCheckout",
    entityId: checkoutId,
    summary: `Manually confirmed payment for checkout ${checkoutId} (receipt ${mpesaReceiptNumber})`,
  });

  revalidatePath("/admin/gift-card-checkouts");
  if (result.status === "expired") {
    redirectWithError("/admin/gift-card-checkouts", "This checkout has expired and can no longer be confirmed.");
  }
  redirectWithSuccess("/admin/gift-card-checkouts", "Checkout marked paid — fulfillment triggered.");
}
