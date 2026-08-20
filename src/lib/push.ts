import "server-only";
import webPush from "web-push";
import { prisma } from "./prisma";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@nuruelectronics.com";

export const isPushConfigured = Boolean(publicKey && privateKey);

if (isPushConfigured) {
  webPush.setVapidDetails(subject, publicKey as string, privateKey as string);
}

export type PushPayload = { title: string; body: string; url?: string };

/**
 * Fans a notification out to every subscribed browser/PWA endpoint — single-owner site, so
 * there's no per-recipient targeting. Degrades non-fatally when push isn't configured, same
 * pattern as sendPlainEmail in email.ts, since this is called from paths (recordPosition) that
 * must never fail just because nobody's generated VAPID keys yet. Prunes subscriptions Web Push
 * reports as gone (404/410 — the browser unsubscribed or the endpoint expired) instead of
 * retrying them forever.
 */
export async function sendPushToAdmin(payload: PushPayload): Promise<void> {
  if (!isPushConfigured) {
    console.log(`[push] not configured — skipping "${payload.title}".`);
    return;
  }
  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const staleIds: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } }, body);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.error("[push] send failed:", error instanceof Error ? error.message : error);
        }
      }
    }),
  );
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }
}
