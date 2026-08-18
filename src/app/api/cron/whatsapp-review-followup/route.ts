import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWhatsAppSendConfigured, normalizeWhatsAppPhone, sendWhatsAppTemplate } from "@/lib/whatsapp-business";
import { constantTimeEqual } from "@/lib/admin-session-token";

const FOLLOW_UP_DELAY_DAYS = 14;
const reviewTemplateSid = process.env.TWILIO_WHATSAPP_REVIEW_TEMPLATE_SID;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function runFollowUps() {
  if (!isWhatsAppSendConfigured || !reviewTemplateSid) {
    const result = { candidates: 0, sent: 0, failed: 0, skipped: "WhatsApp sending not configured" };
    console.log("[cron:whatsapp-review-followup]", result);
    return result;
  }

  const cutoff = new Date(Date.now() - FOLLOW_UP_DELAY_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.receipt.findMany({
    where: { whatsappSentAt: { lte: cutoff }, reviewFollowUpSentAt: null },
    include: { invoice: { include: { order: { include: { customer: true, items: true } } } } },
  });

  let sent = 0;
  let failed = 0;
  for (const receipt of due) {
    try {
      const customer = receipt.invoice.order.customer;
      const to = customer.phone ? normalizeWhatsAppPhone(customer.phone) : null;
      if (!to) throw new Error("Customer has no WhatsApp-capable phone number on file.");

      const productTitle = receipt.invoice.order.items[0]?.title ?? "your purchase";
      await sendWhatsAppTemplate(to, reviewTemplateSid, {
        "1": customer.name ?? "there",
        "2": productTitle,
      });
      await prisma.receipt.update({ where: { id: receipt.id }, data: { reviewFollowUpSentAt: new Date() } });
      sent++;
    } catch (error) {
      // Missing/invalid phone, Twilio provider error, etc. — log and move on to the next candidate.
      console.error(`[cron:whatsapp-review-followup] Failed to send follow-up for receipt ${receipt.id}:`, error);
      failed++;
    }
  }

  const result = { candidates: due.length, sent, failed };
  console.log("[cron:whatsapp-review-followup]", result);
  return result;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await runFollowUps());
  } catch (error) {
    console.error("[cron:whatsapp-review-followup] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
