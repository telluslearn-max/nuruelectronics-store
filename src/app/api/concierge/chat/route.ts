import { runConciergeTurn } from "@/lib/concierge/agent-loop";
import { saveHistoryForCurrentCustomer } from "@/lib/concierge/history";
import { parseConciergeMessages } from "@/lib/concierge/parse-messages";
import type { ConciergeMessage } from "@/lib/concierge/types";
import { isConciergeConfigured } from "@/lib/concierge/vertex-client";

// The Vertex/google-auth-library JWT signing needs Node crypto, not edge.
export const runtime = "nodejs";
export const maxDuration = 60;

function parseMessages(body: unknown): { messages: ConciergeMessage[] } | { error: string } {
  if (body === null || typeof body !== "object") return { error: "body must be a JSON object" };
  if (!("messages" in body)) return { error: "body must include a \"messages\" array" };
  const { messages } = body as { messages: unknown };
  return parseConciergeMessages(messages);
}

export async function POST(request: Request): Promise<Response> {
  if (!isConciergeConfigured) {
    return new Response("Concierge not configured", { status: 503 });
  }

  const rawBody = await request.text();
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return new Response("Invalid request body: not valid JSON", { status: 400 });
  }

  const parsed = parseMessages(body);
  if ("error" in parsed) {
    return new Response(`Invalid request body: ${parsed.error}`, { status: 400 });
  }
  const { messages } = parsed;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let finalText = "";
      try {
        await runConciergeTurn(messages, (event) => {
          if (event.type === "text-delta") finalText += event.text;
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        });
        if (finalText.trim()) {
          await saveHistoryForCurrentCustomer([...messages, { role: "model", text: finalText }]);
        }
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
