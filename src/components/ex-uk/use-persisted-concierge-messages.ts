"use client";

import { useCallback, useRef, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import type { ConciergeDisplayMessage } from "@/components/concierge/use-concierge-messages";
import type { ConciergeEvent } from "@/lib/concierge/types";

/**
 * Ex-UK-scoped sibling of useConciergeMessages (src/components/concierge/use-concierge-messages.ts).
 * Same shape/mutation pattern (required by useConciergeChat/useConciergeVoice), but hydrates from
 * a specific product's saved thread instead of starting empty, and reports every change back via
 * `onChange` so the caller can persist it — the shared concierge widget deliberately has no such
 * persistence, so this lives here rather than parameterizing that shared hook.
 */
export function usePersistedConciergeMessages(
  initialMessages: ConciergeDisplayMessage[],
  onChange: (messages: ConciergeDisplayMessage[]) => void,
) {
  const { setCart } = useCart();
  const [messages, setMessages] = useState<ConciergeDisplayMessage[]>(initialMessages);
  const messagesRef = useRef<ConciergeDisplayMessage[]>(initialMessages);

  const updateMessages = useCallback(
    (updater: (prev: ConciergeDisplayMessage[]) => ConciergeDisplayMessage[]) => {
      const next = updater(messagesRef.current);
      messagesRef.current = next;
      setMessages(next);
      onChange(next);
    },
    [onChange],
  );

  const applyEventToMessage = useCallback(
    (id: string, event: ConciergeEvent) => {
      updateMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (event.type === "text-delta") return { ...m, text: m.text + event.text };
          if (event.type === "products") return { ...m, products: { mode: event.mode, products: event.products } };
          if (event.type === "whatsapp") return { ...m, whatsappMessage: event.message };
          if (event.type === "checkout") return { ...m, checkoutUrl: event.url };
          if (event.type === "audio") return { ...m, audioUrl: `data:${event.mimeType};base64,${event.data}` };
          if (event.type === "error") return { ...m, text: m.text || event.message };
          return m;
        }),
      );
      if (event.type === "cart") setCart(event.cart);
    },
    [setCart, updateMessages],
  );

  return { messages, messagesRef, updateMessages, applyEventToMessage };
}
