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
 * Why a push attempt didn't reach anyone, when it didn't:
 * - "not_configured": VAPID_PRIVATE_KEY (or the public key) isn't set server-side. The client
 *   toggle only checks NEXT_PUBLIC_VAPID_PUBLIC_KEY, so a browser can show "subscribed" while
 *   this is true the whole time — this is the case that looks like a bug from the admin's side.
 * - "no_subscriptions": configured, but nobody has the toggle on in any browser.
 * - "send_failed": configured and subscribed, but every send attempt errored (a Web Push error
 *   other than the expected 404/410 stale-endpoint case).
 */
export type PushResult = { sent: number; skippedReason: "not_configured" | "no_subscriptions" | "send_failed" | null };

/**
 * Fans a notification out to every subscribed browser/PWA endpoint — single-owner site, so
 * there's no per-recipient targeting. Degrades non-fatally when push isn't configured, same
 * pattern as sendPlainEmail in email.ts, since this is called from paths (recordPosition) that
 * must never fail just because nobody's generated VAPID keys yet. Prunes subscriptions Web Push
 * reports as gone (404/410 — the browser unsubscribed or the endpoint expired) instead of
 * retrying them forever.
 *
 * Returns a result instead of nothing so callers that care about delivery (notifyPositionTaken)
 * can tell "nothing to notify" apart from "should have notified and silently didn't" — every
 * failure used to only reach a server console.error the admin has no way to see.
 */
export async function sendPushToAdmin(payload: PushPayload): Promise<PushResult> {
  if (!isPushConfigured) {
    console.log(`[push] not configured — skipping "${payload.title}".`);
    return { sent: 0, skippedReason: "not_configured" };
  }
  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return { sent: 0, skippedReason: "no_subscriptions" };

  const body = JSON.stringify(payload);
  const staleIds: string[] = [];
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } }, body);
        sent++;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          failed++;
          console.error("[push] send failed:", error instanceof Error ? error.message : error);
        }
      }
    }),
  );
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }
  return { sent, skippedReason: sent === 0 && failed > 0 ? "send_failed" : null };
}
