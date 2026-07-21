"use client";

import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { isWhatsAppHandoffConfigured } from "@/lib/concierge/whatsapp-tool";
import type { ConciergeEvent } from "@/lib/concierge/types";
import { getPageContext } from "./page-context";
import { makeMessageId, type ConciergeMessageStore } from "./use-concierge-messages";

const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
];

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string; // "data:<mime>;base64,<data>"
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read recorded audio."));
    reader.readAsDataURL(blob);
  });
}

export type ConciergeRecordingState = "idle" | "recording" | "processing";

export function useConciergeVoice(store: ConciergeMessageStore) {
  const { messagesRef, updateMessages, applyEventToMessage } = store;
  const [recordingState, setRecordingState] = useState<ConciergeRecordingState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const pathname = usePathname();

  const isVoiceSupported =
    typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const sendRecording = useCallback(
    async (blob: Blob, mimeType: string) => {
      // Interrupt any turn still in flight — same pattern as text chat.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      const userMessageId = makeMessageId();
      const assistantId = makeMessageId();
      const historyForRequest = messagesRef.current.map((m) => ({ role: m.role, text: m.text }));

      updateMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user" as const, text: "…" },
        { id: assistantId, role: "model" as const, text: "" },
      ]);
      setRecordingState("processing");

      const handleLine = (line: string) => {
        const event = JSON.parse(line) as ConciergeEvent;
        if (event.type === "transcript") {
          updateMessages((prev) => prev.map((m) => (m.id === userMessageId ? { ...m, text: event.text } : m)));
          return;
        }
        applyEventToMessage(assistantId, event);
      };

      try {
        const data = await blobToBase64(blob);
        const response = await fetch("/api/concierge/voice-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyForRequest,
            audio: { mimeType, data },
            pageContext: getPageContext(pathname),
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
            if (line.trim()) handleLine(line);
          }
        }
        if (buffer.trim()) handleLine(buffer);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Something went wrong.";
        // Same AI-unavailable handoff as the text-chat path (use-concierge-chat.ts) — hand off to
        // a human via WhatsApp rather than leaving the shopper with just a raw error.
        updateMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            if (isWhatsAppHandoffConfigured) {
              return {
                ...m,
                text: m.text || "Sorry, I'm having trouble responding right now.",
                whatsappMessage:
                  m.whatsappMessage ??
                  "Hi! I was chatting with the shopping assistant on the site, but it's temporarily unavailable — could someone from the team help me?",
              };
            }
            return { ...m, text: m.text || `Sorry — ${message}` };
          }),
        );
      } finally {
        if (controllerRef.current === controller) {
          setRecordingState("idle");
          controllerRef.current = null;
        }
      }
    },
    [messagesRef, updateMessages, applyEventToMessage, pathname],
  );

  const startRecording = useCallback(async () => {
    if (!isVoiceSupported || recordingState !== "idle") return;
    const mimeType = pickSupportedMimeType();
    if (!mimeType) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        void sendRecording(blob, mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingState("recording");
    } catch {
      stopStream();
    }
  }, [isVoiceSupported, recordingState, sendRecording, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { isVoiceSupported, recordingState, startRecording, stopRecording };
}
