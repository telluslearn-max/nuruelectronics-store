import type { ConciergeMessage, ConciergePageContext } from "./types";

const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;

/** Optional — absent or malformed pageContext just means "no page context," never a 400. */
export function parsePageContext(value: unknown): ConciergePageContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { productHandle } = value as { productHandle?: unknown };
  return typeof productHandle === "string" && productHandle ? { productHandle } : undefined;
}

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
