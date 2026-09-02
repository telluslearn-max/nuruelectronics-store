import { describe, expect, it } from "vitest";
import { CHIPSET_PERFORMANCE_INDEX, NUMERIC_BANDS, scoreFromBand } from "./reference";
import { getCategorySchema } from "@/lib/intelligence/schema";

describe("scoreFromBand", () => {
  it("maps worst/best to 0/100 and clamps beyond either end", () => {
    expect(scoreFromBand(3000, { worst: 3000, best: 6000 })).toBe(0);
    expect(scoreFromBand(6000, { worst: 3000, best: 6000 })).toBe(100);
    expect(scoreFromBand(4500, { worst: 3000, best: 6000 })).toBe(50);
    expect(scoreFromBand(2000, { worst: 3000, best: 6000 })).toBe(0);
    expect(scoreFromBand(9000, { worst: 3000, best: 6000 })).toBe(100);
  });

  it("handles an inverted band (smaller is better) the same way, just reversed", () => {
    const weight = { worst: 240, best: 150 };
    expect(scoreFromBand(240, weight)).toBe(0);
    expect(scoreFromBand(150, weight)).toBe(100);
    expect(scoreFromBand(300, weight)).toBe(0); // heavier than "worst" still clamps to 0, not negative
  });
});

describe("reference data completeness", () => {
  const schema = getCategorySchema("smartphone")!;

  it("has a numeric band for every scored number/integer attribute except the chipset lookup", () => {
    for (const attr of schema.attributes) {
      if (!attr.scoring) continue;
      if (attr.valueType !== "number" && attr.valueType !== "integer") continue;
      expect(NUMERIC_BANDS[attr.key], `missing NUMERIC_BANDS entry for ${attr.key}`).toBeDefined();
    }
  });

  it("chipset table values are all valid 0-100 scores", () => {
    for (const [chip, score] of Object.entries(CHIPSET_PERFORMANCE_INDEX)) {
      expect(score, chip).toBeGreaterThanOrEqual(0);
      expect(score, chip).toBeLessThanOrEqual(100);
    }
  });
});
