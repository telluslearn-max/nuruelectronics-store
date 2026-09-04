import { describe, expect, it } from "vitest";
import { GAMING_CONSOLE_MODEL_SPECS, GAMING_CONSOLE_SEED } from "./gaming-consoles";
import { getAttribute, getCategorySchema } from "@/lib/intelligence/schema";
import { normalizeRecord } from "@/lib/intelligence/normalize";
import { computeNuruScore } from "@/lib/intelligence/scoring/nuru-score";

const schema = getCategorySchema("gaming_console")!;

describe("gaming console seed", () => {
  it("every seeded handle maps to a model that has specs", () => {
    for (const [handle, entry] of Object.entries(GAMING_CONSOLE_SEED)) {
      expect(GAMING_CONSOLE_MODEL_SPECS[entry.model], `${handle} -> ${entry.model}`).toBeDefined();
      expect(entry.shopifyProductId).toMatch(/^gid:\/\/shopify\/Product\/\d+$/);
    }
  });

  it("every seeded shopify id and handle is unique", () => {
    const ids = Object.values(GAMING_CONSOLE_SEED).map((e) => e.shopifyProductId);
    expect(new Set(ids).size).toBe(ids.length);
    const handles = Object.keys(GAMING_CONSOLE_SEED);
    expect(new Set(handles).size).toBe(handles.length);
  });

  describe.each(Object.entries(GAMING_CONSOLE_MODEL_SPECS))("%s", (model, specs) => {
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

    it("its enum values (display_tech, storage_type, wifi_gen, bluetooth_version, max_output_resolution) all resolve", () => {
      for (const key of ["display_tech", "storage_type", "wifi_gen", "bluetooth_version", "max_output_resolution"] as const) {
        if (!(key in specs)) continue;
        const attr = getAttribute(schema, key)!;
        const value = normalized.get(key)?.normalized.normalizedValue;
        expect(attr.enumValues, key).toContain(value);
      }
    });

    it("produces a composite NURU Score, with camera/value left unscored (no lens, no comparative basis)", () => {
      const resolved = [...normalized.entries()].map(([key, { normalized: n }]) => ({
        key,
        normalizedValue: n.normalizedValue!,
      }));
      const score = computeNuruScore(schema, resolved);
      expect(score.composite).not.toBeNull();
      expect(score.composite!).toBeGreaterThan(0);
      expect(score.composite!).toBeLessThanOrEqual(100);
      expect(score.scoredComponents).not.toContain("camera");
      expect(score.scoredComponents).not.toContain("value");
      // performance, features, display, battery, build, software.
      expect(score.scoredComponents.length).toBeGreaterThanOrEqual(6);
    });
  });
});
