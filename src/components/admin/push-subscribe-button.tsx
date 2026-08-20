"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** web-push wants the VAPID key as a Uint8Array, but the browser Push API's applicationServerKey
 * only accepts base64url — this is the standard conversion (no library ships it, every web-push
 * tutorial hand-rolls the same function). */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

type Status = "checking" | "unsupported" | "unconfigured" | "subscribed" | "unsubscribed" | "denied" | "error";

/** Whether this browser can even attempt push — only meaningful once actually running client-side
 * (checked from an effect, never during render), since `navigator`/`window` don't exist on the
 * server. */
function supportStatus(): "unconfigured" | "unsupported" | "ok" {
  if (!VAPID_PUBLIC_KEY) return "unconfigured";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return "ok";
}

/** Lets the admin opt this browser/PWA install into "a position was taken" push notifications —
 * see src/lib/push.ts (server send) and public/sw.js (the service worker that displays them).
 * The admin dashboard is already an installable PWA (public/admin-manifest.webmanifest), so this
 * is the one control that turns that into somewhere notifications can actually land.
 *
 * Renders null until mounted, always — the server can't evaluate supportStatus() at all (no
 * navigator/window), so the only hydration-safe first paint is the same "nothing yet" on both
 * sides. Anything status-specific only appears after the client has actually mounted and checked. */
export function PushSubscribeButton() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const support = supportStatus();
    if (support !== "ok") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(support);
      return;
    }
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "subscribed" : "unsubscribed"))
      .catch(() => setStatus("unsubscribed"));
  }, [mounted]);

  async function subscribe() {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      // register() resolving only means registration started — pushManager.subscribe() needs an
      // *activated* worker, and on a first-ever registration it's still "installing" at this
      // point. `.ready` is the standard wait for a controlling active worker in this scope.
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
      });
      const response = await fetch("/api/admin/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("Server rejected the subscription.");
      setStatus("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to subscribe.");
      setStatus("error");
    }
  }

  async function unsubscribe() {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/admin/push-subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unsubscribe.");
      setStatus("error");
    }
  }

  if (status === "checking") return null;

  const disabled = status === "unconfigured" || status === "unsupported";
  const on = status === "subscribed";

  function toggle() {
    if (disabled) return;
    if (on) {
      unsubscribe();
    } else {
      subscribe();
    }
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-card border border-border-subtle p-4">
      <div>
        <div className="text-sm font-medium">Notify me when a position is taken</div>
        {status === "unconfigured" && (
          <p className="mt-1 text-xs text-neutral-500">
            Not configured — set <code className="rounded bg-neutral-100 px-1 py-0.5">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> and{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5">VAPID_PRIVATE_KEY</code> to enable.
          </p>
        )}
        {status === "unsupported" && <p className="mt-1 text-xs text-neutral-500">This browser doesn&apos;t support push notifications.</p>}
        {status === "denied" && (
          <p className="mt-1 text-xs text-red-600">Blocked in your browser&apos;s site settings — allow notifications there, then try again.</p>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Notify me when a position is taken"
        disabled={disabled}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          disabled ? "cursor-not-allowed bg-neutral-100" : on ? "bg-foreground" : "bg-neutral-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
