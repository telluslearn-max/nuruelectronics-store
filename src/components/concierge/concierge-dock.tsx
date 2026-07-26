"use client";

import { useEffect, useRef, useState } from "react";
import { ConciergeFab } from "./concierge-fab";
import { ConciergeInputBar } from "./concierge-input-bar";
import { ConciergeSheet } from "./concierge-sheet";
import { useConciergeChat } from "./use-concierge-chat";
import type { ConciergeMessageStore } from "./use-concierge-messages";
import { useConciergeVoice } from "./use-concierge-voice";

/**
 * Floating launcher (Sidekick/Intercom-style): a corner FAB that reveals a
 * bounded floating panel on tap, with the rest of the page left fully
 * visible and interactive behind it — no full-screen backdrop.
 */
export function ConciergeDock({ store }: { store: ConciergeMessageStore }) {
  const { messages } = store;
  const { isStreaming, send } = useConciergeChat(store);
  const { isVoiceSupported, recordingState, startRecording, stopRecording } = useConciergeVoice(store);
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasExpandedRef = useRef(false);

  useEffect(() => {
    if (!isExpanded) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsExpanded(false);
    }
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isExpanded]);

  // The FAB unmounts while the sheet is open and remounts as a new element when it closes, so
  // return focus to it by querying the stable container rather than holding a ref to the FAB
  // button itself — otherwise closing via Escape/outside-click/collapse silently drops focus.
  useEffect(() => {
    if (wasExpandedRef.current && !isExpanded) {
      containerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    wasExpandedRef.current = isExpanded;
  }, [isExpanded]);

  return (
    <div
      ref={containerRef}
      className="fixed right-4 z-40 md:right-6"
      style={{
        bottom: "calc(var(--dock-clear) + env(safe-area-inset-bottom) + (var(--buy-bar-visible) * 4.75rem))",
      }}
    >
      {isExpanded ? (
        <ConciergeSheet
          messages={messages}
          isStreaming={isStreaming || recordingState === "processing"}
          onCollapse={() => setIsExpanded(false)}
        >
          <ConciergeInputBar
            input={input}
            onInputChange={setInput}
            onSubmit={(text) => {
              void send(text);
            }}
            isVoiceSupported={isVoiceSupported}
            recordingState={recordingState}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />
        </ConciergeSheet>
      ) : (
        <ConciergeFab
          onClick={() => {
            setIsExpanded(true);
            setHasOpened(true);
          }}
          hasUnread={messages.length > 0 && !hasOpened}
        />
      )}
    </div>
  );
}
