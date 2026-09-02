import { CHIPSET_PERFORMANCE_INDEX, NUMERIC_BANDS, scoreFromBand } from "@/lib/intelligence/scoring/reference";
import type { SpecAttribute } from "@/lib/intelligence/types";

/**
 * Scores one attribute's normalized value on a 0-100 "how good is this for the
 * buyer" scale, or returns null when the attribute isn't a scoring input, has
 * no reference data, or the value doesn't resolve to one. Null propagates as
 * "not counted," never as a zero — an unscoreable attribute should not read as
 * a bad one. See nuru-score.ts for how per-attribute scores roll up.
 */
export function scoreAttributeValue(attr: SpecAttribute, normalizedValue: string): number | null {
  if (!attr.scoring) return null;

  switch (attr.valueType) {
    case "boolean":
      return normalizedValue === "true" ? 100 : normalizedValue === "false" ? 0 : null;

    case "enum": {
      const rank = attr.enumRank;
      if (!rank || rank.length < 2) return null;
      const index = rank.indexOf(normalizedValue);
      if (index === -1) return null; // an unrecognised value is unscored, not guessed
      return (100 * (rank.length - 1 - index)) / (rank.length - 1);
    }

    case "number":
    case "integer": {
      // The chipset attribute is `text`-typed in the schema (its normalizer produces a
      // canonical name, not a number) but scored via the lookup table below, so it never
      // reaches this branch — handled in the `text` case instead.
      const n = Number(normalizedValue);
      if (!Number.isFinite(n)) return null;
      const band = NUMERIC_BANDS[attr.key];
      if (!band) return null;
      return scoreFromBand(n, band);
    }

    case "text": {
      if (attr.key !== "chipset") return null;
      const index = CHIPSET_PERFORMANCE_INDEX[normalizedValue];
      return index ?? null;
    }
  }
}
