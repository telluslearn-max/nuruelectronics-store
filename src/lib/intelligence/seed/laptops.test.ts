import { describe, expect, it } from "vitest";
import { LAPTOP_MODEL_SPECS, LAPTOP_SEED } from "./laptops";
import { getAttribute, getCategorySchema } from "@/lib/intelligence/schema";
import { normalizeRecord } from "@/lib/intelligence/normalize";
import { computeNuruScore } from "@/lib/intelligence/scoring/nuru-score";
import { LAPTOP_CPU_PERFORMANCE_INDEX } from "@/lib/intelligence/scoring/reference";
import { scoreAttributeValue } from "@/lib/intelligence/scoring/attribute-score";

const schema = getCategorySchema("laptop")!;

describe("laptop seed", () => {
  it("every seeded handle maps to a model that has specs", () => {
    for (const [handle, entry] of Object.entries(LAPTOP_SEED)) {
      expect(LAPTOP_MODEL_SPECS[entry.model], `${handle} -> ${entry.model}`).toBeDefined();
      expect(entry.shopifyProductId).toMatch(/^gid:\/\/shopify\/Product\/\d+$/);
    }
  });

  it("every seeded shopify id and handle is unique", () => {
    const ids = Object.values(LAPTOP_SEED).map((e) => e.shopifyProductId);
    expect(new Set(ids).size).toBe(ids.length);
    const handles = Object.keys(LAPTOP_SEED);
    expect(new Set(handles).size).toBe(handles.length);
  });

  describe.each(Object.entries(LAPTOP_MODEL_SPECS))("%s", (model, specs) => {
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

    it("its cpu is in the laptop performance index", () => {
      const cpuRaw = specs.cpu;
      expect(cpuRaw).toBeTruthy();
      const cpuNorm = normalized.get("cpu")?.normalized.normalizedValue;
      expect(LAPTOP_CPU_PERFORMANCE_INDEX[cpuNorm ?? ""], `${model}: cpu "${cpuNorm}"`).toBeGreaterThan(0);
    });

    it("its enum values (display_tech, storage_type, wifi_gen, bluetooth_version, webcam_max_video) all resolve", () => {
      for (const key of ["display_tech", "storage_type", "wifi_gen", "bluetooth_version", "webcam_max_video"] as const) {
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
      // "value" has no scoring attribute in this schema (see laptop.ts) — every other component should score.
      expect(score.scoredComponents.length).toBeGreaterThanOrEqual(7);
    });
  });

  it("scores a current-generation chip above an older one (post-normalization)", () => {
    const attr = getAttribute(schema, "cpu")!;
    const m4Max = scoreAttributeValue(attr, "M4 Max");
    const m1 = scoreAttributeValue(attr, "M1");
    expect(m4Max).not.toBeNull();
    expect(m1).not.toBeNull();
    expect(m4Max!).toBeGreaterThan(m1!);
  });
});
