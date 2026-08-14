import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, unauthenticated — the checkout page polls this to know when payment/fulfillment lands. Only
// exposes minimal state for a single checkout id, no listing/enumeration capability.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const checkout = await prisma.giftCardCheckout.findUnique({
    where: { id },
    include: { order: { include: { items: { include: { giftCardFulfillment: true } } } } },
  });

  if (!checkout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fulfillment = checkout.order?.items[0]?.giftCardFulfillment ?? null;

  return NextResponse.json({
    checkoutStatus: checkout.status,
    fulfillmentStatus: fulfillment?.status ?? null,
    cardNumber: fulfillment?.status === "completed" ? fulfillment.cardNumber : null,
    pinCode: fulfillment?.status === "completed" ? fulfillment.pinCode : null,
  });
}
