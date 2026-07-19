"use client";

import { useEffect, useRef } from "react";
import type { ConciergeDisplayMessage } from "./use-concierge-chat";
import { ConciergeMessage } from "./concierge-message";

export function ConciergeMessageList({
  messages,
  isStreaming,
}: {
  messages: ConciergeDisplayMessage[];
  isStreaming: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium">Hi, I&apos;m your shopping concierge.</p>
        <p className="text-sm text-neutral-500">
          Ask me to compare products, recommend something for your use case, or help you find the right kit.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.map((message) => (
        <ConciergeMessage key={message.id} message={message} />
      ))}
      {isStreaming && messages[messages.length - 1]?.text === "" && (
        <div className="px-1 text-sm text-neutral-400">Thinking…</div>
      )}
      <div ref={endRef} />
    </div>
  );
}
