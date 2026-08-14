import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit-log";
import { sendOpsAlertEmail } from "@/lib/email";
import { confirmGiftCardCheckoutPaid } from "@/lib/gift-card-checkout-actions";
import { parseNcbaLoopTransactionEvent, verifyNcbaLoopSignature } from "@/lib/ncba-loop/client";

// Amount tolerance — M-Pesa/bank rounding or a customer typing a slightly-off amount shouldn't block an
// otherwise-clearly-matched payment (matched by the unique checkoutCode reference).
const AMOUNT_TOLERANCE_KES = 5;

// Public, unauthenticated per NCBA Loop's webhook model (verified instead by X-Loop-Signature). Confirmed
// unaffected by src/proxy.ts (its matcher excludes all of /api/*) and by MAINTENANCE_MODE.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-loop-signature");

  if (!verifyNcbaLoopSignature(rawBody, signature)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const event = parseNcbaLoopTransactionEvent(payload);
  if (!event) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const checkout = await prisma.giftCardCheckout.findUnique({ where: { checkoutCode: event.reference } });

  if (!checkout) {
    // This money still landed in the account and must be accounted for — don't silently drop it.
    await logAdminAction({
      action: "ncba_loop.unmatched",
      entityType: "ncbaLoopTransaction",
      entityId: event.transactionId,
      summary: `NCBA Loop payment with no matching checkout (reference "${event.reference}", amount ${event.amount})`,
      metadata: { payload },
    });
    try {
      await sendOpsAlertEmail(
        "NCBA Loop payment couldn't be matched to a checkout",
        `<p>Reference "${event.reference}", amount ${event.amount}, transaction ${event.transactionId}.</p><p>This money landed in the account — reconcile it manually.</p>`,
      );
    } catch (alertError) {
      console.error("[ncba-loop] ops alert email failed:", alertError);
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (Math.abs(event.amount - Number(checkout.priceKes)) > AMOUNT_TOLERANCE_KES) {
    await logAdminAction({
      action: "ncba_loop.amount_mismatch",
      entityType: "giftCardCheckout",
      entityId: checkout.id,
      summary: `NCBA Loop payment amount ${event.amount} doesn't match checkout price ${checkout.priceKes}`,
      metadata: { payload },
    });
    try {
      await sendOpsAlertEmail(
        "NCBA Loop payment amount mismatch",
        `<p>Checkout ${checkout.id} expects ${checkout.priceKes} KES but the payment was ${event.amount} KES.</p><p>Reconcile manually.</p>`,
      );
    } catch (alertError) {
      console.error("[ncba-loop] ops alert email failed:", alertError);
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  await confirmGiftCardCheckoutPaid(checkout.id, {
    mpesaReceiptNumber: event.transactionId,
    confirmedVia: "ncba_loop",
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
