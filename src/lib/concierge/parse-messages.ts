import type { ConciergeMessage } from "./types";

const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;

export function parseConciergeMessages(
  messages: unknown,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): { messages: ConciergeMessage[] } | { error: string } {
  if (!Array.isArray(messages)) return { error: '"messages" must be an array' };
  if (!allowEmpty && messages.length === 0) return { error: '"messages" must not be empty' };

  const parsed: ConciergeMessage[] = [];
  for (const [index, entry] of messages.entries()) {
    if (!entry || typeof entry !== "object") return { error: `messages[${index}] must be an object` };
    const { role, text } = entry as { role?: unknown; text?: unknown };
    if (role !== "user" && role !== "model") {
      return { error: `messages[${index}].role must be "user" or "model"` };
    }
    if (typeof text !== "string") return { error: `messages[${index}].text must be a string` };
    parsed.push({ role, text: text.slice(0, MAX_MESSAGE_LENGTH) });
  }
  return { messages: parsed.slice(-MAX_HISTORY_MESSAGES) };
}
