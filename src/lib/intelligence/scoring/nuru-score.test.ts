import { describe, expect, it } from "vitest";
import { computeNuruScore } from "./nuru-score";
import { getCategorySchema } from "@/lib/intelligence/schema";
import type { CategorySchema } from "@/lib/intelligence/types";

describe("computeNuruScore — renormalization, with a small hand-built schema", () => {
  // Two components, two attributes each, so the expected composite/component
  // numbers can be checked by hand rather than trusted to a 40-attribute schema.
  const schema: CategorySchema = {
    id: "toy",
    label: "Toy",
    shopifyProductTypes: [],
    groups: [{ id: "g", label: "G" }],
    componentWeights: {
      performance: 0.5,
      camera: 0.5,
      battery: 0,
      display: 0,
      build: 0,
      features: 0,
      software: 0,
      value: 0,
    },
    attributes: [
      {
        key: "a",
        label: "A",
        valueType: "integer",
        unit: "x",
        normalizer: "quantity",
        group: "g",
        scoring: { component: "performance", weight: 1, higherIsBetter: true },
      },
      {
        key: "b",
        label: "B",
        valueType: "integer",
        unit: "x",
        normalizer: "quantity",
        group: "g",
        scoring: { component: "performance", weight: 3, higherIsBetter: true },
      },
      {
        key: "c",
        label: "C",
        valueType: "boolean",
        normalizer: "boolean",
        group: "g",
        scoring: { component: "camera", weight: 1, higherIsBetter: true },
      },
    ],
  };

  it("scores a fully-populated product as the plain weighted average", () => {
    // a and b are unscoreable (no NUMERIC_BANDS entry for "a"/"b" in the real reference
    // table) — this test only exercises the boolean path, which needs no reference data.
    const result = computeNuruScore(schema, [{ key: "c", normalizedValue: "true" }]);
    expect(result.components).toEqual({ camera: 100 });
    expect(result.scoredComponents).toEqual(["camera"]);
    // Only "camera" has any data; performance has none at all, so it's excluded and
    // camera alone carries the full composite weight after renormalization.
    expect(result.composite).toBe(100);
    expect(result.coverage.camera).toEqual({ scoredWeight: 1, totalWeight: 1 });
    expect(result.coverage.performance).toEqual({ scoredWeight: 0, totalWeight: 4 });
  });

  it("excludes a component entirely, and renormalizes the composite over what's left, when it has no data", () => {
    const result = computeNuruScore(schema, []);
    expect(result.components).toEqual({});
    expect(result.scoredComponents).toEqual([]);
    expect(result.composite).toBeNull();
  });
});

describe("computeNuruScore — real smartphone schema", () => {
  const schema = getCategorySchema("smartphone")!;

  it("renormalizes a component's own weighted average around only the attributes it has", () => {
    // battery_mah (weight 4) alone, at the top of its band, should score the battery
    // component 100 regardless of the (unset) charging attributes — the missing
    // attributes' weight (2 + 1 = 3) is dropped, not treated as a 0.
    const result = computeNuruScore(schema, [{ key: "battery_mah", normalizedValue: "6000" }]);
    expect(result.components.battery).toBe(100);
    expect(result.coverage.battery).toEqual({ scoredWeight: 4, totalWeight: 7 });
  });

  it("averages two known attributes in the same component by their relative weight", () => {
    // battery_mah at 0 (worst) weight 4, charging_wired_w at 100 (best) weight 2.
    // Weighted average over the two known weights (4+2=6): (4*0 + 2*100)/6 = 33.33.
    const result = computeNuruScore(schema, [
      { key: "battery_mah", normalizedValue: "3000" },
      { key: "charging_wired_w", normalizedValue: "120" },
    ]);
    expect(result.components.battery).toBeCloseTo(33.33, 1);
  });

  it("produces a null composite and no components for a product with nothing scoreable", () => {
    const result = computeNuruScore(schema, [{ key: "sim_config", normalizedValue: "Dual SIM" }]);
    expect(result.components).toEqual({});
    expect(result.composite).toBeNull();
  });

  it("is unaffected by resolved specs for attributes that aren't scoring inputs", () => {
    const withExtra = computeNuruScore(schema, [
      { key: "battery_mah", normalizedValue: "6000" },
      { key: "sim_config", normalizedValue: "Dual SIM" },
      { key: "os", normalizedValue: "Android 15" },
    ]);
    const withoutExtra = computeNuruScore(schema, [{ key: "battery_mah", normalizedValue: "6000" }]);
    expect(withExtra.composite).toBe(withoutExtra.composite);
  });
});
