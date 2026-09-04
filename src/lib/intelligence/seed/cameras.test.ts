import { describe, expect, it } from "vitest";
import { CAMERA_MODEL_SPECS, CAMERA_SEED } from "./cameras";
import { getAttribute, getCategorySchema } from "@/lib/intelligence/schema";
import { normalizeRecord } from "@/lib/intelligence/normalize";
import { computeNuruScore } from "@/lib/intelligence/scoring/nuru-score";

const schema = getCategorySchema("camera")!;

describe("camera seed", () => {
  it("every seeded handle maps to a model that has specs", () => {
    for (const [handle, entry] of Object.entries(CAMERA_SEED)) {
      expect(CAMERA_MODEL_SPECS[entry.model], `${handle} -> ${entry.model}`).toBeDefined();
      expect(entry.shopifyProductId).toMatch(/^gid:\/\/shopify\/Product\/\d+$/);
    }
  });

  it("every seeded shopify id and handle is unique", () => {
    const ids = Object.values(CAMERA_SEED).map((e) => e.shopifyProductId);
    expect(new Set(ids).size).toBe(ids.length);
    const handles = Object.keys(CAMERA_SEED);
    expect(new Set(handles).size).toBe(handles.length);
  });

  describe.each(Object.entries(CAMERA_MODEL_SPECS))("%s", (model, specs) => {
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

    it("its enum values (sensor_size, video_max_resolution, usb_standard) all resolve", () => {
      for (const key of ["sensor_size", "video_max_resolution", "usb_standard"] as const) {
        if (!(key in specs)) continue;
        const attr = getAttribute(schema, key)!;
        const value = normalized.get(key)?.normalized.normalizedValue;
        expect(attr.enumValues, key).toContain(value);
      }
    });

    it("produces a composite NURU Score, with software/value contributing little or nothing", () => {
      const resolved = [...normalized.entries()].map(([key, { normalized: n }]) => ({
        key,
        normalizedValue: n.normalizedValue!,
      }));
      const score = computeNuruScore(schema, resolved);
      expect(score.composite).not.toBeNull();
      expect(score.composite!).toBeGreaterThan(0);
      expect(score.composite!).toBeLessThanOrEqual(100);
      expect(score.scoredComponents).not.toContain("value");
      // camera, performance, display, battery, features, build, software.
      expect(score.scoredComponents.length).toBeGreaterThanOrEqual(7);
    });
  });
});
