import { runConciergeTurn } from "@/lib/concierge/agent-loop";
import { saveHistoryForCurrentCustomer } from "@/lib/concierge/history";
import { parseConciergeMessages, parsePageContext } from "@/lib/concierge/parse-messages";
import { isConciergeRateLimited } from "@/lib/concierge/rate-limit";
import type { ConciergeMessage, ConciergePageContext } from "@/lib/concierge/types";
import { isConciergeConfigured } from "@/lib/concierge/vertex-client";
import { getCurrentDbCustomerId } from "@/lib/customer";
import { getClientIp } from "@/lib/request-ip";
import { getOrCreateSessionId } from "@/lib/session";

// The Vertex/google-auth-library JWT signing needs Node crypto, not edge.
export const runtime = "nodejs";
export const maxDuration = 60;

function parseMessages(
  body: unknown,
): { messages: ConciergeMessage[]; pageContext?: ConciergePageContext } | { error: string } {
  if (body === null || typeof body !== "object") return { error: "body must be a JSON object" };
  if (!("messages" in body)) return { error: "body must include a \"messages\" array" };
  const { messages, pageContext } = body as { messages: unknown; pageContext?: unknown };
  const result = parseConciergeMessages(messages);
  if ("error" in result) return result;
  return { messages: result.messages, pageContext: parsePageContext(pageContext) };
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

  const parsed = parseMessages(body);
  if ("error" in parsed) {
    return new Response(`Invalid request body: ${parsed.error}`, { status: 400 });
  }
  const { messages, pageContext } = parsed;
  const sessionId = await getOrCreateSessionId();
  const customerId = await getCurrentDbCustomerId();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let finalText = "";
      try {
        await runConciergeTurn(
          messages,
          (event) => {
            if (event.type === "text-delta") finalText += event.text;
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          },
          pageContext,
          { sessionId, customerId },
        );
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
