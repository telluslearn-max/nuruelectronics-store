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
  onFocus,
  isVoiceSupported,
  recordingState,
  onStartRecording,
  onStopRecording,
  isStreaming = false,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onFocus?: () => void;
  isVoiceSupported: boolean;
  recordingState: ConciergeRecordingState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  /** While the concierge is still replying, block sending another message — without this a
   * shopper who couldn't tell their first message had gone through (audit finding M1, caused by
   * the scroll trap this now-fixed CSS bug produced) could fire a second one on top of it. */
  isStreaming?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isStreaming) return;
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

  // Voice and text are mutually exclusive turns — disable typing/sending while a recording is
  // in progress or being transcribed, rather than letting both fire at once.
  const isVoiceBusy = recordingState !== "idle";

  return (
    <div className="border-t border-border-subtle">
      <div aria-live="polite" className="sr-only">
        {recordingState === "recording"
          ? "Recording your message."
          : recordingState === "processing"
            ? "Processing your recording."
            : ""}
      </div>
      {recordingState === "recording" && (
        <div className="flex items-center gap-2 px-3 pt-2 text-sm text-neutral-500">
          <span className="flex items-end gap-0.5" aria-hidden="true">
            <span className="h-2 w-1 animate-pulse rounded-full bg-red-500 [animation-delay:0ms]" />
            <span className="h-3 w-1 animate-pulse rounded-full bg-red-500 [animation-delay:150ms]" />
            <span className="h-1.5 w-1 animate-pulse rounded-full bg-red-500 [animation-delay:300ms]" />
          </span>
          Listening…
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={onFocus}
          disabled={isVoiceBusy}
          placeholder={isStreaming ? "Concierge is replying…" : "Ask anything…"}
          className="flex-1 rounded-control border border-border-subtle px-3.5 py-2.5 text-sm outline-none focus:border-foreground disabled:opacity-50"
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
          disabled={!input.trim() || isVoiceBusy || isStreaming}
          className="rounded-control bg-foreground px-4 py-2.5 text-sm font-medium text-background transition disabled:opacity-40"
        >
          {isStreaming ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
