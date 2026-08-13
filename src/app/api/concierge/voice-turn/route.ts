import { runConciergeTurn } from "@/lib/concierge/agent-loop";
import { saveHistoryForCurrentCustomer } from "@/lib/concierge/history";
import { parseConciergeMessages, parsePageContext } from "@/lib/concierge/parse-messages";
import { isConciergeRateLimited } from "@/lib/concierge/rate-limit";
import type { ConciergeMessage, ConciergePageContext } from "@/lib/concierge/types";
import { isConciergeConfigured } from "@/lib/concierge/vertex-client";
import { synthesizeSpeech, transcribeAudio } from "@/lib/concierge/voice";
import { getCurrentDbCustomerId } from "@/lib/customer";
import { getClientIp } from "@/lib/request-ip";
import { getOrCreateSessionId } from "@/lib/session";

// Same runtime requirement as /api/concierge/chat — Vertex auth needs Node crypto, not edge.
export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_AUDIO_MIME_PREFIXES = ["audio/webm", "audio/ogg", "audio/wav", "audio/mp4", "audio/aac", "audio/mpeg"];
// ~8MB of raw audio, base64-encoded (base64 runs ~4/3 the size of the source bytes) — generous for a short spoken question, well under Gemini's 20MB inline-data limit.
const MAX_AUDIO_BASE64_LENGTH = 11_000_000;

type VoiceTurnBody = {
  messages: ConciergeMessage[];
  audio: { mimeType: string; data: string };
  pageContext?: ConciergePageContext;
};

function parseBody(body: unknown): VoiceTurnBody | { error: string } {
  if (body === null || typeof body !== "object") return { error: "body must be a JSON object" };
  const { messages, audio, pageContext } = body as { messages?: unknown; audio?: unknown; pageContext?: unknown };

  const messagesResult = parseConciergeMessages(messages ?? [], { allowEmpty: true });
  if ("error" in messagesResult) return messagesResult;

  if (!audio || typeof audio !== "object") return { error: 'body must include an "audio" object' };
  const { mimeType, data } = audio as { mimeType?: unknown; data?: unknown };
  if (typeof mimeType !== "string" || !ALLOWED_AUDIO_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
    return { error: `audio.mimeType must start with one of: ${ALLOWED_AUDIO_MIME_PREFIXES.join(", ")}` };
  }
  if (typeof data !== "string" || data.length === 0) return { error: "audio.data must be a non-empty base64 string" };
  if (data.length > MAX_AUDIO_BASE64_LENGTH) return { error: "audio.data exceeds the size limit" };

  return { messages: messagesResult.messages, audio: { mimeType, data }, pageContext: parsePageContext(pageContext) };
}

export async function POST(request: Request): Promise<Response> {
  if (!isConciergeConfigured) {
    return new Response("Concierge not configured", { status: 503 });
  }

  if (await isConciergeRateLimited(getClientIp(request))) {
    return new Response("Too many requests — please wait a moment and try again.", { status: 429 });
  }

  const rawBody = await request.text();
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return new Response("Invalid request body: not valid JSON", { status: 400 });
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return new Response(`Invalid request body: ${parsed.error}`, { status: 400 });
  }
  const { messages, audio, pageContext } = parsed;
  const sessionId = await getOrCreateSessionId();
  const customerId = await getCurrentDbCustomerId();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const transcript = await transcribeAudio(audio);
        emit({ type: "transcript", text: transcript });

        const history = [...messages, { role: "user" as const, text: transcript }];
        let finalText = "";
        await runConciergeTurn(
          history,
          (event) => {
            if (event.type === "text-delta") finalText += event.text;
            emit(event);
          },
          pageContext,
          { sessionId, customerId },
        );

        if (finalText.trim()) {
          try {
            const audioReply = await synthesizeSpeech(finalText);
            emit({ type: "audio", ...audioReply });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not generate speech for the reply.";
            emit({ type: "error", message });
          }
          await saveHistoryForCurrentCustomer([...history, { role: "model", text: finalText }]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "The concierge hit an unexpected error.";
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
