import "server-only";
import { FunctionCallingConfigMode, type Content, type FunctionCall, type Part } from "@google/genai";
import { CONCIERGE_MODEL, getGenAIClient } from "./vertex-client";
import { buildSystemInstruction } from "./system-prompt";
import { dispatchTool, functionDeclarations } from "./tools";
import type { ConciergeEvent, ConciergeMessage, ConciergePageContext } from "./types";

const MAX_TOOL_ITERATIONS = 6;

/** Read-only lookups safe to force when a message plausibly needs catalog grounding — never a mutating tool like add_to_cart. */
const CATALOG_LOOKUP_TOOLS = ["search_products", "get_product_details", "compare_products", "list_kits_or_ecosystems"];

/**
 * Catches the C2 hallucination pattern: a shopper naming a specific product/model, or asking
 * about availability/comparison, before any tool has grounded the answer.
 *
 * Split into two patterns rather than one `/i`-flagged alternation: a single `i` flag applies to
 * the *whole* regex, so it would also case-fold `[A-Z]` in the product-name branch down to
 * `[a-zA-Z]` — turning "a capitalized word followed by a number" (matching "iPhone 17") into "any
 * word followed by a number" (matching "page 2", "call me at 5"), forcing an unnecessary tool
 * call on ordinary messages that have nothing to do with a product.
 */
const PRODUCT_MODEL_PATTERN = /\b[A-Z][a-zA-Z]*\s?\d{1,3}\b/;
const AVAILABILITY_KEYWORD_PATTERN =
  /compare|\bvs\.?\b|versus|do you (have|carry|sell)|is there|in stock|available|discontinued|unreleased|not released/i;

function needsGrounding(text: string): boolean {
  return PRODUCT_MODEL_PATTERN.test(text) || AVAILABILITY_KEYWORD_PATTERN.test(text);
}

function toContents(history: ConciergeMessage[]): Content[] {
  return history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

export async function runConciergeTurn(
  history: ConciergeMessage[],
  onEvent: (event: ConciergeEvent) => void,
  pageContext?: ConciergePageContext,
): Promise<void> {
  const ai = getGenAIClient();
  const contents = toContents(history);
  const systemInstruction = buildSystemInstruction(pageContext);
  const latestUserMessage = [...history].reverse().find((m) => m.role === "user")?.text ?? "";
  const forceGroundingFirstPass = needsGrounding(latestUserMessage);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const forceGrounding = iteration === 0 && forceGroundingFirstPass;
    const stream = await ai.models.generateContentStream({
      model: CONCIERGE_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: forceGrounding
            ? { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: CATALOG_LOOKUP_TOOLS }
            : { mode: FunctionCallingConfigMode.AUTO },
        },
      },
    });

    let fullText = "";
    const collectedCalls: FunctionCall[] = [];

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onEvent({ type: "text-delta", text });
      }
      const calls = chunk.functionCalls;
      if (calls?.length) collectedCalls.push(...calls);
    }

    if (collectedCalls.length === 0) {
      onEvent({ type: "done" });
      return;
    }

    const modelParts: Part[] = [];
    if (fullText) modelParts.push({ text: fullText });
    for (const call of collectedCalls) modelParts.push({ functionCall: call });
    contents.push({ role: "model", parts: modelParts });

    const responseParts: Part[] = [];
    for (const call of collectedCalls) {
      if (!call.name) continue;
      const { resultForModel, events } = await dispatchTool(call.name, call.args ?? {});
      for (const event of events) onEvent(event);
      responseParts.push({ functionResponse: { name: call.name, response: { output: resultForModel } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  onEvent({
    type: "error",
    message: "That took more steps than expected — try rephrasing or asking something more specific.",
  });
}
