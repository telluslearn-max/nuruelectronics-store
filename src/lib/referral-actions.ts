"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentDbCustomerId } from "./customer";
import { prisma } from "./prisma";

/** Applies an optional "referred by" code entered on /account (task 7) — the closest thing this app
 * has to a signup/checkout form, since account creation and checkout both happen on Shopify's side.
 * Silently no-ops on an invalid code, a self-referral, or if a referrer is already set, rather than
 * surfacing a hard error for what's an optional, low-stakes field. */
export async function applyReferralCode(formData: FormData): Promise<void> {
  const code = String(formData.get("referralCode") ?? "").trim().toUpperCase();
  if (!code) redirect("/account");

  const customerId = await getCurrentDbCustomerId();
  if (!customerId) redirect("/account");

  const self = await prisma.customer.findUnique({ where: { id: customerId }, select: { referredByCustomerId: true } });
  if (self?.referredByCustomerId) redirect("/account");

  const referrer = await prisma.customer.findUnique({ where: { referralCode: code } });
  if (!referrer || referrer.id === customerId) redirect("/account?referralError=1");

  await prisma.customer.update({ where: { id: customerId }, data: { referredByCustomerId: referrer.id } });
  revalidatePath("/account");
  redirect("/account?referralSuccess=1");
}
