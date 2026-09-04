import { describe, expect, it } from "vitest";
import { TABLET_MODEL_SPECS, TABLET_SEED } from "./tablets";
import { getAttribute, getCategorySchema } from "@/lib/intelligence/schema";
import { normalizeRecord } from "@/lib/intelligence/normalize";
import { computeNuruScore } from "@/lib/intelligence/scoring/nuru-score";
import { LAPTOP_CPU_PERFORMANCE_INDEX } from "@/lib/intelligence/scoring/reference";

const schema = getCategorySchema("tablet")!;

describe("tablet seed", () => {
  it("every seeded handle maps to a model that has specs", () => {
    for (const [handle, entry] of Object.entries(TABLET_SEED)) {
      expect(TABLET_MODEL_SPECS[entry.model], `${handle} -> ${entry.model}`).toBeDefined();
      expect(entry.shopifyProductId).toMatch(/^gid:\/\/shopify\/Product\/\d+$/);
    }
  });

  it("every seeded shopify id and handle is unique", () => {
    const ids = Object.values(TABLET_SEED).map((e) => e.shopifyProductId);
    expect(new Set(ids).size).toBe(ids.length);
    const handles = Object.keys(TABLET_SEED);
    expect(new Set(handles).size).toBe(handles.length);
  });

  describe.each(Object.entries(TABLET_MODEL_SPECS))("%s", (model, specs) => {
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

    it("its cpu is in the shared laptop-class performance index", () => {
      const cpuRaw = specs.cpu;
      expect(cpuRaw).toBeTruthy();
      const cpuNorm = normalized.get("cpu")?.normalized.normalizedValue;
      expect(LAPTOP_CPU_PERFORMANCE_INDEX[cpuNorm ?? ""], `${model}: cpu "${cpuNorm}"`).toBeGreaterThan(0);
    });

    it("its enum values (display_tech, cellular, wifi_gen, usb_standard, video_max_resolution) all resolve", () => {
      for (const key of ["display_tech", "cellular", "wifi_gen", "usb_standard", "video_max_resolution"] as const) {
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
      // "value" has no scoring attribute in this schema — every other component should score.
      expect(score.scoredComponents.length).toBeGreaterThanOrEqual(7);
    });
  });
});
