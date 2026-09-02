import { describe, expect, it } from "vitest";
import { SCORE_COMPONENTS } from "@/lib/intelligence/types";
import { getCategorySchema, listCategorySchemas, schemaForShopifyProductType } from "./index";

describe("category schema registry", () => {
  it("resolves the smartphone schema by id and by Shopify product type", () => {
    expect(getCategorySchema("smartphone")?.label).toBe("Smartphone");
    expect(schemaForShopifyProductType("Smartphones")?.id).toBe("smartphone");
    expect(schemaForShopifyProductType("smartphones")?.id).toBe("smartphone");
    expect(getCategorySchema("toaster")).toBeNull();
  });
});

describe.each(listCategorySchemas())("$id schema is internally consistent", (schema) => {
  it("has unique attribute keys", () => {
    const keys = schema.attributes.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("component weights cover every component and sum to 1", () => {
    const keys = Object.keys(schema.componentWeights).sort();
    expect(keys).toEqual([...SCORE_COMPONENTS].sort());
    const sum = Object.values(schema.componentWeights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("every attribute's group is declared in schema.groups", () => {
    const groups = new Set(schema.groups.map((g) => g.id));
    for (const a of schema.attributes) expect(groups.has(a.group)).toBe(true);
  });

  it("enum attributes declare their allowed values", () => {
    for (const a of schema.attributes) {
      if (a.normalizer === "enum" || a.valueType === "enum") {
        expect(a.enumValues && a.enumValues.length).toBeTruthy();
      }
    }
  });

  it("a scored enum attribute declares a full ranking of its values", () => {
    for (const a of schema.attributes) {
      if (a.scoring && a.valueType === "enum") {
        expect(a.enumRank).toBeDefined();
        expect([...(a.enumRank ?? [])].sort()).toEqual([...(a.enumValues ?? [])].sort());
      }
    }
  });

  it("numeric attributes carry a unit; text/enum/boolean attributes don't", () => {
    for (const a of schema.attributes) {
      if (a.valueType === "number" || a.valueType === "integer") {
        // `android_version` is a bare number (no unit) — allow the exception explicitly.
        if (a.key === "android_version") continue;
        expect(a.unit, `${a.key} should have a unit`).toBeTruthy();
      } else {
        expect(a.unit, `${a.key} should not have a unit`).toBeUndefined();
      }
    }
  });

  it("scoring weights are positive", () => {
    for (const a of schema.attributes) {
      if (a.scoring) expect(a.scoring.weight).toBeGreaterThan(0);
    }
  });
});
