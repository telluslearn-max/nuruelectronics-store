"use server";

import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { verifyFeedbackToken } from "./feedback-token";

export async function submitFeedback(token: string, formData: FormData): Promise<void> {
  const payload = verifyFeedbackToken(token);
  if (!payload) redirect(`/feedback/${token}?error=1`);

  const ratingRaw = formData.get("rating");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  if (rating === null || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`/feedback/${token}?error=1`);
  }
  const comment = String(formData.get("comment") ?? "").trim() || null;

  const order = await prisma.order.findUnique({ where: { id: payload.orderId } });
  if (!order || order.customerId !== payload.customerId) {
    redirect(`/feedback/${token}?error=1`);
  }

  const existing = await prisma.feedback.findFirst({
    where: { orderId: payload.orderId, customerId: payload.customerId },
  });
  if (!existing) {
    await prisma.feedback.create({
      data: {
        orderId: payload.orderId,
        customerId: payload.customerId,
        rating,
        comment,
        collectedVia: "EMAIL_FOLLOWUP",
      },
    });
  }

  redirect(`/feedback/${token}?success=1`);
}
