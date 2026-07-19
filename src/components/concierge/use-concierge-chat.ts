"use client";

import { useCallback, useRef, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import type { ConciergeEvent } from "@/lib/concierge/types";
import type { Product } from "@/lib/shopify/types";

export type ConciergeDisplayMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  products?: { mode: "list" | "compare"; products: Product[] };
  whatsappMessage?: string;
};

let nextId = 0;
function makeId() {
  nextId += 1;
  return `concierge-${nextId}`;
}

export function useConciergeChat() {
  const { setCart } = useCart();
  const [messages, setMessages] = useState<ConciergeDisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Interrupt any turn still in flight — the shopper's new message takes over rather
      // than waiting for a now-irrelevant answer to finish.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      const userMessage: ConciergeDisplayMessage = { id: makeId(), role: "user", text: trimmed };
      const assistantId = makeId();
      let historyForRequest: ConciergeDisplayMessage[] = [];

      setMessages((prev) => {
        historyForRequest = [...prev, userMessage];
        return [...historyForRequest, { id: assistantId, role: "model", text: "" }];
      });
      setIsStreaming(true);

      function applyEvent(event: ConciergeEvent) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            if (event.type === "text-delta") return { ...m, text: m.text + event.text };
            if (event.type === "products") return { ...m, products: { mode: event.mode, products: event.products } };
            if (event.type === "whatsapp") return { ...m, whatsappMessage: event.message };
            if (event.type === "error") return { ...m, text: m.text || event.message };
            return m;
          }),
        );
        if (event.type === "cart") setCart(event.cart);
      }

      try {
        const response = await fetch("/api/concierge/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyForRequest.map((m) => ({ role: m.role, text: m.text })),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Concierge request failed (${response.status}).`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) applyEvent(JSON.parse(line) as ConciergeEvent);
          }
        }
        if (buffer.trim()) applyEvent(JSON.parse(buffer) as ConciergeEvent);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, text: m.text || `Sorry — ${message}` } : m)),
        );
      } finally {
        if (controllerRef.current === controller) {
          setIsStreaming(false);
          controllerRef.current = null;
        }
      }
    },
    [setCart],
  );

  return { messages, isStreaming, send };
}
