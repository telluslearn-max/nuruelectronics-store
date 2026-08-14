"use client";

import { useEffect, useState } from "react";

type StatusResponse = {
  checkoutStatus: "pending" | "paid" | "expired";
  fulfillmentStatus: "pending" | "completed" | "failed" | null;
  cardNumber: string | null;
  pinCode: string | null;
};

const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 180; // ~30 minutes at the interval above

export function GiftCardCheckoutStatusPoller({
  checkoutId,
  initialStatus,
  whatsappUrl,
}: {
  checkoutId: string;
  initialStatus: StatusResponse;
  whatsappUrl: string | null;
}) {
  const [status, setStatus] = useState<StatusResponse>(initialStatus);

  useEffect(() => {
    if (status.checkoutStatus !== "pending") return;
    let cancelled = false;
    let attempt = 0;

    async function poll() {
      try {
        const res = await fetch(`/api/gift-card-checkout/${checkoutId}/status`, { cache: "no-store" });
        if (res.ok) {
          const data: StatusResponse = await res.json();
          if (cancelled) return;
          setStatus(data);
          if (data.checkoutStatus !== "pending") return; // stop polling once resolved
        }
      } catch {
        // network hiccup — just try again next tick
      }
      attempt += 1;
      if (attempt > MAX_POLLS || cancelled) return;
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    const timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutId]);

  if (status.checkoutStatus === "paid" && status.fulfillmentStatus === "completed") {
    return (
      <div className="mt-6 rounded-card border border-green-200 bg-green-50 p-5">
        <p className="font-medium text-green-800">Payment confirmed — here&apos;s your code</p>
        <p className="mt-3">
          Code: <span className="font-mono font-semibold">{status.cardNumber}</span>
        </p>
        {status.pinCode && (
          <p className="mt-1">
            PIN: <span className="font-mono font-semibold">{status.pinCode}</span>
          </p>
        )}
        <p className="mt-3 text-sm text-neutral-600">We also emailed and WhatsApp&apos;d it to you.</p>
      </div>
    );
  }

  if (status.checkoutStatus === "paid" && status.fulfillmentStatus === "failed") {
    return (
      <div className="mt-6 rounded-card border border-amber-200 bg-amber-50 p-5">
        <p className="font-medium text-amber-800">Payment received — sourcing your code</p>
        <p className="mt-2 text-sm text-amber-800">
          There was a hiccup sourcing your code automatically. Our team has been notified and will follow up shortly.
        </p>
      </div>
    );
  }

  if (status.checkoutStatus === "expired") {
    return (
      <div className="mt-6 rounded-card border border-border-subtle p-5">
        <p className="font-medium">This checkout has expired</p>
        <p className="mt-2 text-sm text-neutral-500">Go back and start a new one — prices refresh with the current rate.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-card border border-border-subtle p-5">
      <p className="font-medium">Waiting for payment…</p>
      <p className="mt-2 text-sm text-neutral-500">This page updates automatically once we receive your payment.</p>
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm underline hover:text-foreground"
        >
          Already paid? Send us your M-Pesa confirmation on WhatsApp
        </a>
      )}
    </div>
  );
}
