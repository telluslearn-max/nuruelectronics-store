"use client";

import { useEffect, useRef, useState } from "react";
import { ConciergeMessageList } from "./concierge-message-list";
import { useConciergeChat } from "./use-concierge-chat";

export function ConciergePanel({ onClose }: { onClose: () => void }) {
  const { messages, isStreaming, send } = useConciergeChat();
  const [input, setInput] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input;
    setInput("");
    void send(text);
    inputRef.current?.focus();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping concierge"
      className="fixed inset-0 z-40 flex flex-col bg-background sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[600px] sm:w-[400px] sm:rounded-card sm:border sm:border-border-subtle sm:shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <h2 className="text-base font-semibold">Shopping concierge</h2>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close concierge"
          className="flex h-9 w-9 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ConciergeMessageList messages={messages} isStreaming={isStreaming} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border-subtle p-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a product, compare two, or find a kit…"
          className="flex-1 rounded-control border border-border-subtle px-3.5 py-2.5 text-sm outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-control bg-foreground px-4 py-2.5 text-sm font-medium text-background transition disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
