"use client";

import { useEffect, useRef, useState } from "react";
import { ConciergeInputBar } from "./concierge-input-bar";
import { ConciergeSheet } from "./concierge-sheet";
import { useConciergeChat } from "./use-concierge-chat";
import type { ConciergeMessageStore } from "./use-concierge-messages";
import { useConciergeVoice } from "./use-concierge-voice";

/**
 * Always-visible bottom-docked input — this is the launcher now, no separate button. Expands a
 * sheet above itself (dimmed backdrop, rounded top corners) rather than taking over the whole
 * screen, so the shopper can still see what page they're on. Collapsing never fully hides it,
 * matching the persistent-but-collapsible pattern this is modeled on.
 */
export function ConciergeDock({ store }: { store: ConciergeMessageStore }) {
  const { messages } = store;
  const { isStreaming, send } = useConciergeChat(store);
  const { isVoiceSupported, recordingState, startRecording, stopRecording } = useConciergeVoice(store);
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const hasAutoExpanded = useRef(false);

  // Returning to a page mid-conversation (history restored from Firestore) opens straight to the
  // transcript rather than making the shopper re-expand it themselves.
  useEffect(() => {
    if (!hasAutoExpanded.current && messages.length > 0) {
      hasAutoExpanded.current = true;
      setIsExpanded(true);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!isExpanded) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsExpanded(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  return (
    <>
      {isExpanded && (
        <button
          aria-label="Collapse concierge"
          onClick={() => setIsExpanded(false)}
          className="fixed inset-0 z-40 animate-fade-in bg-black/40"
        />
      )}
      <div className="fixed inset-x-0 bottom-14 z-40 flex flex-col md:bottom-0">
        {isExpanded && (
          <ConciergeSheet
            messages={messages}
            isStreaming={isStreaming || recordingState === "processing"}
            onCollapse={() => setIsExpanded(false)}
          />
        )}
        <div className="border-t border-border-subtle bg-background">
          <ConciergeInputBar
            input={input}
            onInputChange={setInput}
            onSubmit={(text) => {
              setIsExpanded(true);
              void send(text);
            }}
            onFocus={() => setIsExpanded(true)}
            isVoiceSupported={isVoiceSupported}
            recordingState={recordingState}
            onStartRecording={() => {
              setIsExpanded(true);
              void startRecording();
            }}
            onStopRecording={stopRecording}
          />
        </div>
      </div>
    </>
  );
}
