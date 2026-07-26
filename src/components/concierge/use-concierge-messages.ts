"use client";

import { useCallback, useRef, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { trackEvent } from "@/lib/analytics/track-event";
import type { ConciergeEvent, ConciergeMessage } from "@/lib/concierge/types";
import type { Product } from "@/lib/shopify/types";

export type ConciergeDisplayMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  products?: { mode: "list" | "compare"; products: Product[] };
  whatsappMessage?: string;
  checkoutUrl?: string;
  audioUrl?: string;
  /** A non-fatal error alongside an otherwise-successful reply (e.g. TTS synthesis failed after
      the text reply already streamed in) — kept separate from `text` so it's shown, not dropped. */
  errorNote?: string;
};

let nextId = 0;
export function makeMessageId(): string {
  nextId += 1;
  return `concierge-${nextId}`;
}

/**
 * Shared message store for the concierge panel — text and voice turns both append to and
 * render from this single list, so switching between typing and talking mid-conversation
 * keeps full context. Tracks messages in a ref alongside state (not just via setState
 * callbacks) because a sibling setState call in the same event-handler tick can suppress
 * React's eager updater invocation, making state read back from a setState callback stale.
 */
export function useConciergeMessages(initialMessages: ConciergeMessage[] = []) {
  const { cart, setCart } = useCart();
  const [messages, setMessages] = useState<ConciergeDisplayMessage[]>(() =>
    initialMessages.map((m) => ({ id: makeMessageId(), role: m.role, text: m.text })),
  );
  const messagesRef = useRef<ConciergeDisplayMessage[]>(messages);

  const updateMessages = useCallback((updater: (prev: ConciergeDisplayMessage[]) => ConciergeDisplayMessage[]) => {
    const next = updater(messagesRef.current);
    messagesRef.current = next;
    setMessages(next);
  }, []);

  /** Applies an NDJSON event to the message with `id` — shared by text and voice turns. */
  const applyEventToMessage = useCallback(
    (id: string, event: ConciergeEvent) => {
      updateMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (event.type === "text-delta") return { ...m, text: m.text + event.text };
          if (event.type === "products") return { ...m, products: { mode: event.mode, products: event.products } };
          if (event.type === "whatsapp") return { ...m, whatsappMessage: event.message };
          if (event.type === "checkout") {
            trackEvent("begin_checkout", {
              currency: cart?.cost.totalAmount.currencyCode,
              value: cart ? Number(cart.cost.totalAmount.amount) : undefined,
            });
            return { ...m, checkoutUrl: event.url };
          }
          if (event.type === "audio") return { ...m, audioUrl: `data:${event.mimeType};base64,${event.data}` };
          // Don't let an existing reply swallow the error (e.g. TTS synthesis failing after the
          // text already streamed in) — only fall back to using it as the message body when
          // there's no text to show at all.
          if (event.type === "error") return m.text ? { ...m, errorNote: event.message } : { ...m, text: event.message };
          return m;
        }),
      );
      if (event.type === "cart") setCart(event.cart);
    },
    [cart, setCart, updateMessages],
  );

  return { messages, messagesRef, updateMessages, applyEventToMessage };
}

export type ConciergeMessageStore = ReturnType<typeof useConciergeMessages>;
