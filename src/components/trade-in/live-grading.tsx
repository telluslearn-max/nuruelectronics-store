"use client";

import { GoogleGenAI, type Session } from "@google/genai";
import { useEffect, useRef, useState } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { buildWhatsAppUrl, productUrl } from "@/lib/whatsapp";

type Status = "idle" | "starting" | "live" | "error" | "stopped";

const FRAME_INTERVAL_MS = 1800;

/**
 * Live camera trade-in condition grading — a genuine Gemini Live session (real-time video
 * streaming, not a single request/response call). Connects directly from the browser to Gemini
 * using a short-lived ephemeral token minted by /api/live-grading/token; the actual grading model
 * and instructions are locked into that token server-side, this component never sees them.
 * Advisory only: never states a price, always hands off to a human via WhatsApp to confirm.
 */
export function LiveGradingSection({ productTitle, productHandle }: { productTitle: string; productHandle: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [assessment, setAssessment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopSession() {
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    frameTimerRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => stopSession, []);

  function sendFrame(session: Session) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
    if (!base64) return;
    session.sendRealtimeInput({ video: { data: base64, mimeType: "image/jpeg" } });
  }

  async function start() {
    setError(null);
    setAssessment("");
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const res = await fetch("/api/live-grading/token", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Couldn't start a live session.");

      const ai = new GoogleGenAI({ apiKey: body.token, httpOptions: { apiVersion: "v1alpha" } });
      const session = await ai.live.connect({
        model: body.model,
        callbacks: {
          onopen: () => setStatus("live"),
          onmessage: (message) => {
            const text = message.text;
            if (text) setAssessment((prev) => prev + text);
          },
          onerror: () => {
            setError("Connection lost — try again.");
            setStatus("error");
          },
          onclose: () => setStatus((prev) => (prev === "error" ? prev : "stopped")),
        },
      });
      sessionRef.current = session;
      frameTimerRef.current = setInterval(() => sendFrame(session), FRAME_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't access the camera.");
      setStatus("error");
      stopSession();
    }
  }

  function stop() {
    stopSession();
    setStatus("stopped");
  }

  const whatsappMessage = `Hi! I just got an AI condition estimate for my trade-in device toward ${productTitle}${
    assessment ? ` — the estimate said: "${assessment.trim()}"` : ""
  }. I'd like to confirm the actual trade-in value.\n${productUrl(productHandle)}`;
  const whatsappHref = buildWhatsAppUrl(whatsappMessage);

  return (
    <div className="mt-3 rounded-card border border-border-subtle p-4">
      <p className="text-sm font-medium">Get an instant AI condition estimate</p>
      <p className="mt-1 text-xs text-neutral-500">
        Point your camera at the device you&apos;re trading in — Gemini gives a rough grade live. Advisory only; a
        person confirms the real value over WhatsApp.
      </p>

      {(status === "idle" || status === "stopped") && (
        <button
          type="button"
          onClick={start}
          className="mt-3 w-full rounded-control border border-border-subtle px-4 py-2.5 text-sm font-medium transition hover:border-foreground"
        >
          Start camera estimate
        </button>
      )}

      {(status === "starting" || status === "live") && (
        <div className="mt-3 space-y-3">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video w-full rounded-lg bg-neutral-900 object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          {status === "starting" && <p className="text-xs text-neutral-500">Connecting…</p>}
          {assessment && <p className="rounded-card bg-neutral-50 p-3 text-sm">{assessment}</p>}
          <button
            type="button"
            onClick={stop}
            className="w-full rounded-control border border-border-subtle px-4 py-2.5 text-sm font-medium transition hover:border-foreground"
          >
            Stop
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {status === "stopped" && assessment && whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle px-4 py-2.5 text-sm font-medium transition hover:border-foreground"
        >
          <WhatsAppIcon className="h-4 w-4 shrink-0 text-whatsapp" />
          Confirm value on WhatsApp
        </a>
      )}
    </div>
  );
}
