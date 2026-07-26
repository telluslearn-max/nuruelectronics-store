import "server-only";
import { prisma } from "@/lib/prisma";

const WINDOW_MINUTES = 1;
const MAX_REQUESTS_PER_WINDOW = 8;

/**
 * The concierge endpoints are unauthenticated (any storefront visitor can call them) and each
 * request drives several paid Vertex/Gemini calls, so a per-IP sliding-window cap is needed to
 * bound cost from scripted abuse. This is approximate under concurrent requests from the same IP
 * (no row locking) — acceptable for a cost guardrail, unlike the exact-count requirements of the
 * ledger/payment code.
 */
export async function isConciergeRateLimited(ipAddress: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const count = await prisma.conciergeRequestLog.count({ where: { ipAddress, createdAt: { gte: since } } });
  if (count >= MAX_REQUESTS_PER_WINDOW) return true;
  await prisma.conciergeRequestLog.create({ data: { ipAddress } });
  return false;
}
