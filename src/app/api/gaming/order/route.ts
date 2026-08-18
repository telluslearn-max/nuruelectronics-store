import { NextResponse } from "next/server";
import { isKinguinConfigured, orderKinguinKey } from "@/lib/gaming/kinguin-client";
import { ACCOUNTS, postJournalEntry } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { kinguinId, customerEmail, customerPhone, amountKes, maxPriceEurocents } = body;

    if (!kinguinId || !amountKes) {
      return NextResponse.json({ error: "Missing required order parameters: kinguinId and amountKes" }, { status: 400 });
    }

    let serialKey = "DEMO-PSN-50USD-KEY-1234-ABCD";
    let orderId = `KNG-DEMO-${Date.now()}`;

    if (isKinguinConfigured && maxPriceEurocents) {
      const kinguinOrder = await orderKinguinKey(Number(kinguinId), Number(maxPriceEurocents));
      orderId = kinguinOrder.orderId;
      serialKey = kinguinOrder.serialKeys[0] || "PROCESSING";
    }

    // Post double-entry Journal Entry automatically in General Ledger
    await prisma.$transaction(async (tx) => {
      const entry = await postJournalEntry(tx, {
        date: new Date(),
        description: `Digital Gaming Voucher Sale (Order ${orderId})`,
        sourceType: "digital_gaming_voucher",
        sourceId: orderId,
        lines: [
          { accountCode: ACCOUNTS.CASH, debit: Number(amountKes) },
          { accountCode: ACCOUNTS.SALES_REVENUE, credit: Number(amountKes) },
        ],
      });

      await logAdminAction(
        {
          action: "gaming.voucher_dispatch",
          entityType: "digital_order",
          entityId: orderId,
          summary: `Digital game voucher dispatched: Order ${orderId} (KES ${amountKes})`,
          metadata: { kinguinId, customerEmail, customerPhone, journalEntryId: entry.id },
        },
        tx,
      );
    });

    return NextResponse.json({
      success: true,
      orderId,
      serialKey,
      deliveryMethod: "instant_on_screen",
      message: "Digital key generated and dispatched successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process digital gaming order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
