import { NextResponse } from "next/server";
import { verifyCircleWebhookSignature } from "@/lib/capital-circle/circle-webhook-verify";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit-log";

/**
 * Receives Circle's wallet-transaction notifications. Subscribe this URL to
 * `transactions.inbound` via Circle's console/API once deployed (Circle
 * can't reach localhost, so this can only be wired up for real after a
 * production deploy). Only ever pre-fills a pending sweep's detected
 * amount — it never confirms one. Confirming is always a human clicking
 * "Confirm sweep" on /admin/reports/capital-circle, per the no-autonomous-
 * money-movement design of the rest of Capital Circle.
 *
 * NOTE: the `notification` field paths below (walletId, amounts, state,
 * transactionType) are assembled from Circle's documented field names for
 * transactions.inbound, but haven't been checked against a real captured
 * payload — that's only possible once Circle can actually deliver one to a
 * live URL. Any shape mismatch is logged with the full raw payload so the
 * first real delivery is easy to diagnose and adjust against.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-circle-signature");
  const keyId = request.headers.get("x-circle-key-id");

  if (!signature || !keyId) {
    return new Response("Missing signature headers", { status: 400 });
  }

  const isValid = await verifyCircleWebhookSignature(rawBody, signature, keyId);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (payload.notificationType !== "transactions.inbound") {
    return NextResponse.json({ handled: false, reason: "not an inbound transaction notification" });
  }

  const notification = (payload.notification ?? {}) as Record<string, unknown>;
  if (notification.state !== "COMPLETE") {
    return NextResponse.json({ handled: false, reason: `state is ${String(notification.state)}, waiting for COMPLETE` });
  }

  const circleWalletId = typeof notification.walletId === "string" ? notification.walletId : null;
  const wallet = circleWalletId ? await prisma.capitalCircleWallet.findUnique({ where: { circleWalletId } }) : null;
  if (!wallet) {
    console.log("[circle-webhook] inbound transaction for an unregistered wallet, ignoring:", rawBody);
    return NextResponse.json({ handled: false, reason: "wallet not registered" });
  }

  const amount = Array.isArray(notification.amounts) ? Number(notification.amounts[0]) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    console.log("[circle-webhook] couldn't parse a positive amount, ignoring:", rawBody);
    return NextResponse.json({ handled: false, reason: "no parseable amount" });
  }

  const txHash = typeof notification.id === "string" ? notification.id : null;

  const pendingSweep = await prisma.capitalCircleSweep.findFirst({
    where: { status: "pending", walletId: wallet.id, detectedAt: null },
    orderBy: { weekStart: "asc" },
  });

  if (!pendingSweep) {
    await logAdminAction({
      action: "capital-circle.wallet.deposit.unmatched",
      entityType: "capital_circle_wallet",
      entityId: wallet.id,
      summary: `Inbound $${amount.toFixed(2)} landed in the Capital Circle wallet with no pending sweep to match it against.`,
      metadata: { circleWalletId, amount, txHash },
    });
    return NextResponse.json({ handled: false, reason: "no pending sweep to match" });
  }

  await prisma.capitalCircleSweep.update({
    where: { id: pendingSweep.id },
    data: { detectedUsdcAmount: amount.toFixed(2), detectedAt: new Date(), detectedTxHash: txHash },
  });
  await logAdminAction({
    action: "capital-circle.sweep.deposit-detected",
    entityType: "capital_circle_sweep",
    entityId: pendingSweep.id,
    summary: `Detected $${amount.toFixed(2)} USDC landing in the Capital Circle wallet — pre-filled, awaiting confirmation.`,
    metadata: { circleWalletId, amount, txHash },
  });

  return NextResponse.json({ handled: true, sweepId: pendingSweep.id, amount });
}
