"use client";

import { useEffect, useRef, useState } from "react";
import { ConciergeInputBar } from "./concierge-input-bar";
import { ConciergeMessageList } from "./concierge-message-list";
import { useConciergeChat } from "./use-concierge-chat";
import { useConciergeMessages } from "./use-concierge-messages";
import { useConciergeVoice } from "./use-concierge-voice";

export function ConciergePanel({
  onClose,
  initialMessage,
}: {
  onClose: () => void;
  /** Sent automatically as the first user turn once, e.g. to open a chat already scoped to a product. */
  initialMessage?: string;
}) {
  const store = useConciergeMessages();
  const { messages } = store;
  const { isStreaming, send } = useConciergeChat(store);
  const { isVoiceSupported, recordingState, startRecording, stopRecording } = useConciergeVoice(store);
  const [input, setInput] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasSentInitialMessage = useRef(false);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!initialMessage || hasSentInitialMessage.current || messages.length > 0) return;
    hasSentInitialMessage.current = true;
    void send(initialMessage);
  }, [initialMessage, messages.length, send]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Shopping concierge" className="fixed inset-0 z-40 flex flex-col bg-background">
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
        <ConciergeMessageList messages={messages} isStreaming={isStreaming || recordingState === "processing"} />
      </div>

      <ConciergeInputBar
        input={input}
        onInputChange={setInput}
        onSubmit={(text) => void send(text)}
        isVoiceSupported={isVoiceSupported}
        recordingState={recordingState}
        onStartRecording={() => void startRecording()}
        onStopRecording={stopRecording}
      />
    </div>
  );
}
