import "server-only";
import { FunctionCallingConfigMode, type Content, type FunctionCall, type Part } from "@google/genai";
import { CAPITAL_CIRCLE_MODEL, MAX_TOOL_ITERATIONS } from "./config";
import { getGenAIClient, isCapitalCircleConfigured } from "./vertex-client";
import { buildCapitalCircleSystemInstruction } from "./system-prompt";
import { dispatchTool, functionDeclarations } from "./tools";

export type CapitalCircleCycleResult = {
  ran: boolean;
  summary: string;
  toolCallCount: number;
};

/**
 * One weekly cycle, driven by a fixed task instruction rather than chat
 * history — there's no shopper on the other end. Otherwise mirrors
 * concierge/agent-loop.ts's bounded tool-calling loop shape exactly: call
 * the model, dispatch any function calls, feed results back, repeat until
 * the model stops calling tools or the iteration cap is hit.
 */
export async function runCapitalCircleCycle(): Promise<CapitalCircleCycleResult> {
  if (!isCapitalCircleConfigured) {
    return {
      ran: false,
      summary: "Capital Circle isn't configured — Vertex AI credentials (shared with the concierge) are unset.",
      toolCallCount: 0,
    };
  }

  const ai = getGenAIClient();
  const systemInstruction = buildCapitalCircleSystemInstruction();
  const contents: Content[] = [
    { role: "user", parts: [{ text: "Run this week's Capital Circle cycle." }] },
  ];

  let toolCallCount = 0;
  let lastText = "";

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = await ai.models.generateContentStream({
      model: CAPITAL_CIRCLE_MODEL,
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
      if (text) fullText += text;
      const calls = chunk.functionCalls;
      if (calls?.length) collectedCalls.push(...calls);
    }

    if (fullText) lastText = fullText;

    if (collectedCalls.length === 0) {
      return { ran: true, summary: lastText || "Cycle finished with no summary text.", toolCallCount };
    }

    const modelParts: Part[] = [];
    if (fullText) modelParts.push({ text: fullText });
    for (const call of collectedCalls) modelParts.push({ functionCall: call });
    contents.push({ role: "model", parts: modelParts });

    const responseParts: Part[] = [];
    for (const call of collectedCalls) {
      if (!call.name) continue;
      const { resultForModel } = await dispatchTool(call.name, call.args ?? {});
      toolCallCount++;
      responseParts.push({ functionResponse: { name: call.name, response: { output: resultForModel } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    ran: true,
    summary: lastText || "Cycle hit the iteration cap before concluding — treat as inconclusive, not a decision.",
    toolCallCount,
  };
}
