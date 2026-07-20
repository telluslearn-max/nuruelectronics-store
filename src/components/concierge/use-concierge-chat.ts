"use client";

import { useCallback, useRef, useState } from "react";
import type { ConciergeEvent } from "@/lib/concierge/types";
import { makeMessageId, type ConciergeDisplayMessage, type ConciergeMessageStore } from "./use-concierge-messages";

export function useConciergeChat(store: ConciergeMessageStore) {
  const { messagesRef, updateMessages, applyEventToMessage } = store;
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

      const userMessage: ConciergeDisplayMessage = { id: makeMessageId(), role: "user", text: trimmed };
      const assistantId = makeMessageId();
      const historyForRequest = [...messagesRef.current, userMessage];

      updateMessages(() => [...historyForRequest, { id: assistantId, role: "model", text: "" }]);
      setIsStreaming(true);

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
            if (line.trim()) applyEventToMessage(assistantId, JSON.parse(line) as ConciergeEvent);
          }
        }
        if (buffer.trim()) applyEventToMessage(assistantId, JSON.parse(buffer) as ConciergeEvent);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Something went wrong.";
        updateMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, text: m.text || `Sorry — ${message}` } : m)),
        );
      } finally {
        if (controllerRef.current === controller) {
          setIsStreaming(false);
          controllerRef.current = null;
        }
      }
    },
    [messagesRef, updateMessages, applyEventToMessage],
  );

  return { isStreaming, send };
}
