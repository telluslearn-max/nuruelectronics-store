import { listCategorySchemas } from "@/lib/intelligence/schema";
import type { FitWeights } from "@/lib/intelligence/recommend/fit-score";
import type { ScoreComponent } from "@/lib/intelligence/types";

/**
 * Turns a natural search like "best gaming phone under 40k" into structured
 * filters the deterministic engine can act on:
 *
 *   { categoryId: "smartphone", budgetMax: 40000, weights: { performance: 3, ... }, freeText: "" }
 *
 * This is a keyword classifier, not an LLM call — the search engine has to work
 * with no model in the loop (the build brief: the engine works independently of
 * the conversational layer). When the concierge *is* in the loop it passes an
 * explicit `weights` vector that supersedes whatever this guessed, so a shopper
 * who says something this table doesn't cover still gets a good result — just
 * one turn later.
 */

export type SearchIntent = {
  /** A category-schema id if the query named one, else null. */
  categoryId: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  /** A brand name if one was recognised, title-cased. */
  brand: string | null;
  /** Priority weights inferred from intent keywords ("gaming" → performance-heavy). Empty if none matched. */
  weights: FitWeights;
  /** What's left of the query after filters were pulled out — feeds semantic search. */
  freeText: string;
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  smartphone: ["phone", "smartphone", "handset", "mobile"],
};

/** A whole-token (word-boundary, plural-tolerant) matcher for `keyword`. */
function wordRe(keyword: string, flags = "i"): RegExp {
  return new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?($|[^a-z0-9])`, flags);
}

/** Removes every whole-token occurrence of `keyword` (and its plural) from `text` — so "photography" isn't mangled into "graphy". */
function stripWord(text: string, keyword: string): string {
  return text.replace(new RegExp(wordRe(keyword, "gi").source, "gi"), "$1 $2");
}

const BRANDS = [
  "Samsung", "Apple", "iPhone", "Google", "Pixel", "Xiaomi", "Redmi", "Poco",
  "OnePlus", "Nothing", "Tecno", "Infinix", "Oppo", "Vivo", "Realme", "Honor", "Huawei",
];

/** Maps a stated use-case to a partial priority vector (relative weights, any positive scale). */
const INTENT_WEIGHTS: { keywords: string[]; weights: FitWeights }[] = [
  {
    keywords: ["gaming", "game", "gamer", "pubg", "fortnite", "genshin"],
    weights: { performance: 4, display: 2, battery: 2, value: 1 },
  },
  {
    keywords: ["photo", "photography", "camera", "vlog", "vlogging", "content", "instagram"],
    weights: { camera: 4, display: 2, battery: 1, value: 1 },
  },
  {
    keywords: ["battery", "long lasting", "endurance", "travel", "trip", "outdoor", "field"],
    weights: { battery: 4, performance: 1, value: 2 },
  },
  {
    keywords: ["performance", "fast", "powerful", "flagship", "power user", "multitask"],
    weights: { performance: 4, display: 1, software: 1 },
  },
  {
    keywords: ["value", "budget", "cheap", "affordable", "bang for", "student"],
    weights: { value: 4, battery: 2, performance: 1 },
  },
  {
    keywords: ["media", "movies", "netflix", "youtube", "watching", "streaming"],
    weights: { display: 4, battery: 2, performance: 1 },
  },
  {
    keywords: ["business", "work", "professional", "office", "email", "productivity"],
    weights: { software: 3, performance: 2, battery: 2, build: 1 },
  },
  {
    keywords: ["compact", "small", "one hand", "one-handed", "lightweight", "pocket"],
    weights: { build: 4, display: 1, battery: 1 },
  },
  {
    keywords: ["durable", "rugged", "tough", "waterproof", "sturdy"],
    weights: { build: 4, battery: 1 },
  },
];

/**
 * Parses "40k", "40,000", "ksh 40000", "KES 40k", "under 50000", "40-60k".
 * Returns amounts in whole shillings.
 */
function parseBudget(text: string): { min: number | null; max: number | null; matched: string[] } {
  const matched: string[] = [];
  let min: number | null = null;
  let max: number | null = null;

  const toAmount = (raw: string): number => {
    const cleaned = raw.replace(/[,\s]/g, "").toLowerCase();
    const k = /k$/.test(cleaned);
    const n = Number(cleaned.replace(/k$/, "").replace(/[^0-9.]/g, ""));
    return k ? Math.round(n * 1000) : Math.round(n);
  };

  const range = text.match(/(?:ksh?|kes)?\s*([0-9][0-9,.]*\s*k?)\s*(?:-|to|–)\s*(?:ksh?|kes)?\s*([0-9][0-9,.]*\s*k?)/i);
  if (range) {
    min = toAmount(range[1]);
    max = toAmount(range[2]);
    matched.push(range[0]);
    return { min, max, matched };
  }

  const under = text.match(/(?:under|below|less than|up to|max(?:imum)?|<=?)\s*(?:ksh?|kes)?\s*([0-9][0-9,.]*\s*k?)/i);
  if (under) {
    max = toAmount(under[1]);
    matched.push(under[0]);
  }
  const over = text.match(/(?:over|above|more than|from|min(?:imum)?|>=?)\s*(?:ksh?|kes)?\s*([0-9][0-9,.]*\s*k?)/i);
  if (over) {
    min = toAmount(over[1]);
    matched.push(over[0]);
  }
  if (min === null && max === null) {
    const bare = text.match(/(?:ksh?|kes|around|about|~)\s*([0-9][0-9,.]*\s*k?)/i);
    if (bare) {
      max = toAmount(bare[1]);
      matched.push(bare[0]);
    }
  }
  return { min, max, matched };
}

/** Parses a raw search query into structured filters. Pure and deterministic. */
export function parseSearchIntent(query: string): SearchIntent {
  const original = query.trim();
  const lower = original.toLowerCase();
  let remainder = ` ${lower} `;

  // Category
  let categoryId: string | null = null;
  for (const schema of listCategorySchemas()) {
    const keywords = CATEGORY_KEYWORDS[schema.id] ?? [schema.id];
    if (keywords.some((k) => wordRe(k).test(remainder))) {
      categoryId = schema.id;
      for (const k of keywords) remainder = stripWord(remainder, k);
      break;
    }
  }

  // Budget
  const budget = parseBudget(original);
  for (const m of budget.matched) remainder = remainder.replace(m.toLowerCase(), " ");

  // Brand
  let brand: string | null = null;
  for (const b of BRANDS) {
    if (remainder.includes(` ${b.toLowerCase()} `)) {
      brand = b === "iPhone" ? "Apple" : b === "Pixel" ? "Google" : b;
      break;
    }
  }

  // Priority weights — each matching rule contributes its vector once, and every
  // matched keyword is pulled out of the remainder (as a whole token, so
  // "photography" isn't mangled into "graphy") so free text is what's left.
  const weights: FitWeights = {};
  for (const rule of INTENT_WEIGHTS) {
    const matched = rule.keywords.filter((k) => wordRe(k).test(lower));
    if (matched.length === 0) continue;
    for (const [component, weight] of Object.entries(rule.weights) as [ScoreComponent, number][]) {
      weights[component] = (weights[component] ?? 0) + weight;
    }
    for (const keyword of matched) remainder = stripWord(remainder, keyword);
  }

  const freeText = remainder
    .replace(/\b(best|top|good|great|recommend|show me|find me|looking for|need|want|a|an|the|for|with|me)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { categoryId, budgetMin: budget.min, budgetMax: budget.max, brand, weights, freeText };
}
