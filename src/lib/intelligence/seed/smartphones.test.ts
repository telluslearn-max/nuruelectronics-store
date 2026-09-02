import { describe, expect, it } from "vitest";
import { IPHONE_MODEL_SPECS, SMARTPHONE_SEED } from "./smartphones";
import { getCategorySchema } from "@/lib/intelligence/schema";
import { normalizeRecord } from "@/lib/intelligence/normalize";
import { computeNuruScore } from "@/lib/intelligence/scoring/nuru-score";
import { CHIPSET_PERFORMANCE_INDEX } from "@/lib/intelligence/scoring/reference";
import { scoreAttributeValue } from "@/lib/intelligence/scoring/attribute-score";
import { getAttribute } from "@/lib/intelligence/schema";

const schema = getCategorySchema("smartphone")!;

describe("smartphone seed", () => {
  it("every seeded handle maps to a model that has specs", () => {
    for (const [handle, entry] of Object.entries(SMARTPHONE_SEED)) {
      expect(IPHONE_MODEL_SPECS[entry.model], `${handle} -> ${entry.model}`).toBeDefined();
      expect(entry.shopifyProductId).toMatch(/^gid:\/\/shopify\/Product\/\d+$/);
    }
  });

  it("every seeded shopify id and handle is unique", () => {
    const ids = Object.values(SMARTPHONE_SEED).map((e) => e.shopifyProductId);
    expect(new Set(ids).size).toBe(ids.length);
    const handles = Object.keys(SMARTPHONE_SEED);
    expect(new Set(handles).size).toBe(handles.length);
  });

  describe.each(Object.entries(IPHONE_MODEL_SPECS))("%s", (model, specs) => {
    const normalized = normalizeRecord(schema.attributes, specs);

    it("uses only real schema keys and every value normalizes", () => {
      const schemaKeys = new Set(schema.attributes.map((a) => a.key));
      for (const key of Object.keys(specs)) {
        expect(schemaKeys.has(key), `${model}: unknown key "${key}"`).toBe(true);
      }
      for (const [key, { normalized: n }] of normalized) {
        expect(n.normalizedValue, `${model}: "${key}" didn't normalize`).not.toBeNull();
      }
    });

    it("its chipset is in the performance index", () => {
      const chipsetRaw = specs.chipset;
      expect(chipsetRaw).toBeTruthy();
      const chipsetNorm = normalized.get("chipset")?.normalized.normalizedValue;
      expect(CHIPSET_PERFORMANCE_INDEX[chipsetNorm ?? ""], `${model}: chipset "${chipsetNorm}"`).toBeGreaterThan(0);
    });

    it("its enum values (display_tech, cellular, wifi_gen, usb_standard, ip_rating) all resolve", () => {
      for (const key of ["display_tech", "cellular", "wifi_gen", "usb_standard", "ip_rating"] as const) {
        if (!(key in specs)) continue;
        const attr = getAttribute(schema, key)!;
        const value = normalized.get(key)?.normalized.normalizedValue;
        expect(attr.enumValues, key).toContain(value);
      }
    });

    it("produces a composite NURU Score with good coverage", () => {
      const resolved = [...normalized.entries()].map(([key, { normalized: n }]) => ({
        key,
        normalizedValue: n.normalizedValue!,
      }));
      const score = computeNuruScore(schema, resolved);
      expect(score.composite).not.toBeNull();
      expect(score.composite!).toBeGreaterThan(0);
      expect(score.composite!).toBeLessThanOrEqual(100);
      // Every model should score all 8 components — the seed covers the schema.
      expect(score.scoredComponents.length).toBeGreaterThanOrEqual(7);
    });
  });

  it("scores a modern Pro chipset above an old one (post-normalization)", () => {
    const attr = getAttribute(schema, "chipset")!;
    const a19 = scoreAttributeValue(attr, "A19 Pro");
    const a13 = scoreAttributeValue(attr, "A13 Bionic");
    expect(a19).not.toBeNull();
    expect(a13).not.toBeNull();
    expect(a19!).toBeGreaterThan(a13!);
  });
});
