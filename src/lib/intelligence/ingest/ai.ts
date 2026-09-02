import "server-only";
import { getGenAIClient, isConciergeConfigured } from "@/lib/concierge/vertex-client";
import type { CategorySchema } from "@/lib/intelligence/types";
import type { SpecRun } from "@/lib/intelligence/ingest/reconcile";

/**
 * The automated spec-research pass.
 *
 * For one product, Gemini runs a grounded search (Google Search tool) against
 * the exact model and returns the category schema's attributes as a flat JSON
 * object of raw strings. It is run more than once by the caller and the results
 * reconciled (see reconcile.ts) — this module is only responsible for one
 * clean pass and for not inventing structure the model didn't return.
 *
 * Everything it produces is written at `low` confidence: a grounded search is a
 * good gap-filler and a poor source of record. A Shopify metafield or a later
 * correction always wins over it.
 *
 * `googleSearch` can't be combined with `responseSchema` in one call, so the
 * JSON is parsed defensively from the response text rather than schema-enforced.
 */

export const INTELLIGENCE_INGEST_MODEL = "gemini-2.5-flash";

/** How many independent grounded passes per product. Reconciliation needs ≥2. */
export const INGEST_SAMPLES = Number(process.env.INTELLIGENCE_INGEST_SAMPLES ?? 2);

export const isIngestConfigured = isConciergeConfigured;

export type AiResearchResult = {
  run: SpecRun;
  /** Distinct source URLs Gemini's grounding actually used, best-effort. */
  citations: string[];
};

/** The grounded-search prompt for one product: every schema attribute, its unit/enum, and instructions to omit rather than guess. */
export function buildResearchPrompt(
  schema: CategorySchema,
  product: { title: string; vendor?: string; variant?: string },
): string {
  const attrLines = schema.attributes
    .map((a) => `- ${a.key}: ${a.label}${a.unit ? ` (in ${a.unit})` : ""}${a.enumValues ? ` — one of: ${a.enumValues.join(" / ")}` : ""}`)
    .join("\n");

  return [
    `You are compiling a verified specification sheet for a single ${schema.label.toLowerCase()} sold in Kenya.`,
    ``,
    `Product: ${product.title}`,
    product.vendor ? `Brand: ${product.vendor}` : "",
    product.variant ? `Variant: ${product.variant}` : "",
    ``,
    `Search for this exact model's published specifications. Return a single JSON object whose keys are drawn from the list below. For each spec you can corroborate from the search results, give a short value string (include the unit). OMIT any key you are not confident about for THIS exact model — a missing key is correct and expected; a guessed value is not. Do not include commentary.`,
    ``,
    `Attributes:`,
    attrLines,
    ``,
    `Also include a "sources" key: an array of the specification-page URLs you relied on.`,
    ``,
    `Respond with only the JSON object.`,
  ]
    .filter(Boolean)
    .join("\n");
}

const KNOWN_JSON_BLOCK = /\{[\s\S]*\}/;

/**
 * Pull the spec object out of a grounded response. Tolerates ```json fences,
 * leading prose, and a trailing citation paragraph. Unknown keys and non-string
 * scalars are coerced or dropped; `sources` is lifted out into `citations`.
 */
export function parseResearchResponse(text: string, schema: CategorySchema): AiResearchResult {
  const match = text.match(KNOWN_JSON_BLOCK);
  if (!match) return { run: {}, citations: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return { run: {}, citations: [] };
  }
  if (!parsed || typeof parsed !== "object") return { run: {}, citations: [] };

  const record = parsed as Record<string, unknown>;
  const schemaKeys = new Set(schema.attributes.map((a) => a.key));
  const run: SpecRun = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "sources" || !schemaKeys.has(key)) continue;
    if (typeof value === "string" && value.trim()) run[key] = value.trim();
    else if (typeof value === "number" || typeof value === "boolean") run[key] = String(value);
  }

  const citations = Array.isArray(record.sources)
    ? [...new Set(record.sources.filter((s): s is string => typeof s === "string" && /^https?:\/\//.test(s)))]
    : [];

  return { run, citations };
}

/** Grounding URLs from the response's own `groundingMetadata`, if present. */
function citationsFromGrounding(response: unknown): string[] {
  try {
    const chunks =
      (response as { candidates?: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] } }[] })
        .candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    return [...new Set(chunks.map((c) => c.web?.uri).filter((u): u is string => Boolean(u)))];
  } catch {
    return [];
  }
}

/** One grounded research pass for one product. Returns null if Gemini isn't configured or the call fails. */
export async function researchProductSpecs(
  schema: CategorySchema,
  product: { title: string; vendor?: string; variant?: string },
): Promise<AiResearchResult | null> {
  if (!isIngestConfigured) return null;
  try {
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: INTELLIGENCE_INGEST_MODEL,
      contents: [{ role: "user", parts: [{ text: buildResearchPrompt(schema, product) }] }],
      config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
    });
    const parsed = parseResearchResponse(response.text ?? "", schema);
    const citations = [...new Set([...parsed.citations, ...citationsFromGrounding(response)])];
    return { run: parsed.run, citations };
  } catch (error) {
    console.error(`[intelligence:ingest-ai] research failed for "${product.title}":`, error);
    return null;
  }
}
