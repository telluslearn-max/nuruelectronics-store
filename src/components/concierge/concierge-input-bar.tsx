"use client";

import { useRef } from "react";
import type { ConciergeRecordingState } from "./use-concierge-voice";

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 0 1-14 0M12 18v3" />
    </svg>
  );
}

export function ConciergeInputBar({
  input,
  onInputChange,
  onSubmit,
  isVoiceSupported,
  recordingState,
  onStartRecording,
  onStopRecording,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  isVoiceSupported: boolean;
  recordingState: ConciergeRecordingState;
  onStartRecording: () => void;
  onStopRecording: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input;
    onInputChange("");
    onSubmit(text);
    inputRef.current?.focus();
  }

  const micLabel =
    recordingState === "recording"
      ? "Stop recording"
      : recordingState === "processing"
        ? "Processing your message"
        : "Record a voice message";

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border-subtle p-3">
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Ask about a product, compare two, or find a kit…"
        className="flex-1 rounded-control border border-border-subtle px-3.5 py-2.5 text-sm outline-none focus:border-foreground"
      />
      {isVoiceSupported && (
        <button
          type="button"
          onClick={recordingState === "recording" ? onStopRecording : onStartRecording}
          disabled={recordingState === "processing"}
          aria-label={micLabel}
          aria-pressed={recordingState === "recording"}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${
            recordingState === "recording"
              ? "animate-pulse border-red-500 bg-red-500 text-white"
              : "border-border-subtle hover:border-foreground"
          }`}
        >
          <MicIcon className="h-5 w-5" />
        </button>
      )}
      <button
        type="submit"
        disabled={!input.trim()}
        className="rounded-control bg-foreground px-4 py-2.5 text-sm font-medium text-background transition disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
