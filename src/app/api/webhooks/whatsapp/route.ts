import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf, renderReceiptPdf } from "@/lib/pdf/render";
import { sendWhatsAppDocument, verifyWebhookChallenge } from "@/lib/whatsapp";

/** Meta's one-time handshake when you register this URL as the webhook callback. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (verifyWebhookChallenge(mode, token) && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WhatsAppWebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          button?: { payload?: string };
          interactive?: { button_reply?: { id?: string } };
        }[];
      };
    }[];
  }[];
};

async function deliverInvoice(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { order: { include: { customer: true, items: true } } },
  });
  if (!invoice?.order.customer.phone) return;

  const pdfBuffer = await renderInvoicePdf(invoice, invoice.order, invoice.order.customer, invoice.order.items);
  await sendWhatsAppDocument({
    to: invoice.order.customer.phone,
    pdfBuffer,
    filename: `${invoice.number}.pdf`,
    caption: `Invoice ${invoice.number}`,
  });
}

async function deliverReceipt(receiptId: string): Promise<void> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { invoice: { include: { order: { include: { customer: true } } } } },
  });
  if (!receipt?.invoice.order.customer.phone) return;

  const pdfBuffer = await renderReceiptPdf(receipt, receipt.invoice, receipt.invoice.order.customer);
  await sendWhatsAppDocument({
    to: receipt.invoice.order.customer.phone,
    pdfBuffer,
    filename: `${receipt.number}.pdf`,
    caption: `Receipt ${receipt.number}`,
  });
}

async function handleButtonPayload(payload: string): Promise<void> {
  const [type, id] = payload.split(":");
  if (type === "invoice" && id) await deliverInvoice(id);
  if (type === "receipt" && id) await deliverReceipt(id);
}

/**
 * Incoming events — we only act on quick-reply button taps (payload format
 * "invoice:<id>" / "receipt:<id>", set when we send the template message in
 * admin-actions.ts). Always returns 200 quickly; Meta disables a webhook that
 * repeatedly errors or times out, so a delivery failure is logged, not thrown.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WhatsAppWebhookPayload;
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages ?? [];

    for (const message of messages) {
      const payload = message.button?.payload ?? message.interactive?.button_reply?.id;
      if (payload) await handleButtonPayload(payload);
    }
  } catch (error) {
    console.error("WhatsApp webhook handling failed:", error);
  }

  return NextResponse.json({ received: true });
}
