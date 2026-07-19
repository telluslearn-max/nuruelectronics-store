import "server-only";
import { FunctionCallingConfigMode, type Content, type FunctionCall, type Part } from "@google/genai";
import { CONCIERGE_MODEL, getGenAIClient } from "./vertex-client";
import { buildSystemInstruction } from "./system-prompt";
import { dispatchTool, functionDeclarations } from "./tools";
import type { ConciergeEvent, ConciergeMessage } from "./types";

const MAX_TOOL_ITERATIONS = 6;

function toContents(history: ConciergeMessage[]): Content[] {
  return history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

export async function runConciergeTurn(
  history: ConciergeMessage[],
  onEvent: (event: ConciergeEvent) => void,
): Promise<void> {
  const ai = getGenAIClient();
  const contents = toContents(history);
  const systemInstruction = buildSystemInstruction();

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = await ai.models.generateContentStream({
      model: CONCIERGE_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
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
