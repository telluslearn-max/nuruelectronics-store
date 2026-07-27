import "server-only";
import { prisma } from "@/lib/prisma";

const WINDOW_MINUTES = 10;
const MAX_REQUESTS_PER_WINDOW = 3;

/**
 * Each call mints a real Gemini Live ephemeral session token — a far more expensive resource than
 * one concierge chat turn — so this gets its own, tighter per-IP cap rather than sharing
 * src/lib/concierge/rate-limit.ts's cost profile. Same approximate-under-concurrency tradeoff.
 */
export async function isLiveGradingRateLimited(ipAddress: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const count = await prisma.liveGradingSessionLog.count({ where: { ipAddress, createdAt: { gte: since } } });
  if (count >= MAX_REQUESTS_PER_WINDOW) return true;
  await prisma.liveGradingSessionLog.create({ data: { ipAddress } });
  return false;
}
