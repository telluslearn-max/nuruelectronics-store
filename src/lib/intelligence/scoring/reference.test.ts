import { describe, expect, it } from "vitest";
import { CHIPSET_PERFORMANCE_INDEX, LAPTOP_CPU_PERFORMANCE_INDEX, NUMERIC_BANDS, TEXT_LOOKUP_TABLES, scoreFromBand } from "./reference";
import { getCategorySchema, listCategorySchemas } from "@/lib/intelligence/schema";

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

  it("laptop CPU table values are all valid 0-100 scores", () => {
    for (const [cpu, score] of Object.entries(LAPTOP_CPU_PERFORMANCE_INDEX)) {
      expect(score, cpu).toBeGreaterThanOrEqual(0);
      expect(score, cpu).toBeLessThanOrEqual(100);
    }
  });
});

describe.each(listCategorySchemas())("$id reference coverage", (schema) => {
  it("has a numeric band or a text lookup table for every scored attribute", () => {
    for (const attr of schema.attributes) {
      if (!attr.scoring) continue;
      if (attr.valueType === "number" || attr.valueType === "integer") {
        expect(NUMERIC_BANDS[attr.key], `missing NUMERIC_BANDS entry for ${schema.id}.${attr.key}`).toBeDefined();
      } else if (attr.valueType === "text") {
        expect(TEXT_LOOKUP_TABLES[attr.key], `missing TEXT_LOOKUP_TABLES entry for ${schema.id}.${attr.key}`).toBeDefined();
      }
    }
  });
});
