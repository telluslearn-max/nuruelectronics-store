import type { IntelSourceType, SpecConfidence } from "@prisma/client";

/**
 * Confidence is assigned from where a fact came from, never by a person — there
 * is no verification screen. The ladder, highest to lowest:
 *
 *   nuru_csv          NURU's own maintained spec sheet. Someone typed it on
 *                     purpose against a real device or an official sheet.  → verified
 *   manufacturer      An official manufacturer spec page / data sheet.     → high
 *   shopify_metafield A `specs`-namespace metafield on the live product.   → high
 *   benchmark_db      A named third-party benchmark database.              → medium
 *   ai_grounded       A Gemini grounded-search pass. Useful for filling
 *                     gaps, never trusted over anything above it.          → low
 *   manual            Reserved; no writer yet.                             → medium
 *
 * The comparison and scoring engines take the highest-confidence SpecValue for
 * each (product, attribute) and drop anything below a per-use floor rather than
 * show a low-confidence guess as a fact.
 */
export function confidenceForSourceType(type: IntelSourceType): SpecConfidence {
  switch (type) {
    case "nuru_csv":
      return "verified";
    case "manufacturer":
    case "shopify_metafield":
      return "high";
    case "benchmark_db":
    case "manual":
      return "medium";
    case "ai_grounded":
      return "low";
  }
}

/** Numeric rank for a confidence level — higher is more trustworthy. `unknown` is 0. */
export function confidenceRank(confidence: SpecConfidence): number {
  switch (confidence) {
    case "verified":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    case "unknown":
      return 0;
  }
}

/** True when `confidence` is at least `floor` on the ladder. */
export function meetsConfidenceFloor(confidence: SpecConfidence, floor: SpecConfidence): boolean {
  return confidenceRank(confidence) >= confidenceRank(floor);
}
