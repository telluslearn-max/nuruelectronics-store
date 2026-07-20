import { runConciergeTurn } from "@/lib/concierge/agent-loop";
import type { ConciergeMessage } from "@/lib/concierge/types";
import { isConciergeConfigured } from "@/lib/concierge/vertex-client";

// The Vertex/google-auth-library JWT signing needs Node crypto, not edge.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;

function parseMessages(body: unknown): ConciergeMessage[] | null {
  if (!body || typeof body !== "object" || !("messages" in body)) return null;
  const { messages } = body as { messages: unknown };
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const parsed: ConciergeMessage[] = [];
  for (const entry of messages) {
    if (!entry || typeof entry !== "object") return null;
    const { role, text } = entry as { role?: unknown; text?: unknown };
    if ((role !== "user" && role !== "model") || typeof text !== "string") return null;
    parsed.push({ role, text: text.slice(0, MAX_MESSAGE_LENGTH) });
  }
  return parsed.slice(-MAX_HISTORY_MESSAGES);
}

export async function POST(request: Request): Promise<Response> {
  if (!isConciergeConfigured) {
    return new Response("Concierge not configured", { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const messages = parseMessages(body);
  if (!messages) {
    return new Response("Invalid request body", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runConciergeTurn(messages, (event) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The concierge hit an unexpected error.";
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message })}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
