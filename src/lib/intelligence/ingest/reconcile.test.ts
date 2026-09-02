import { describe, expect, it } from "vitest";
import { reconcileRuns } from "./reconcile";
import { getCategorySchema } from "@/lib/intelligence/schema";

const schema = getCategorySchema("smartphone")!;

describe("reconcileRuns", () => {
  it("agrees on numbers within tolerance despite different phrasing", () => {
    const result = reconcileRuns(schema, [
      { battery_mah: "5000mAh" },
      { battery_mah: "5,000 mAh" },
    ]);
    expect(result.agreed).toEqual([
      { key: "battery_mah", rawValue: "5000mAh", normalizedValue: "5000", unit: "mah" },
    ]);
    expect(result.conflicted).toEqual([]);
  });

  it("rejects a numeric conflict outside tolerance", () => {
    const result = reconcileRuns(schema, [{ battery_mah: "5000mAh" }, { battery_mah: "4200mAh" }]);
    expect(result.agreed).toEqual([]);
    expect(result.conflicted).toEqual(["battery_mah"]);
  });

  it("accepts a small rounding difference within the default 2% tolerance", () => {
    const result = reconcileRuns(schema, [{ display_size_in: "6.7 in" }, { display_size_in: "6.74 in" }]);
    expect(result.agreed[0]?.key).toBe("display_size_in");
  });

  it("requires an exact match for text/enum attributes", () => {
    const result = reconcileRuns(schema, [{ display_tech: "Super AMOLED" }, { display_tech: "AMOLED" }]);
    // Both normalize to "AMOLED" — should agree despite different raw phrasing.
    expect(result.agreed[0]).toMatchObject({ key: "display_tech", normalizedValue: "AMOLED" });

    const conflicting = reconcileRuns(schema, [{ display_tech: "AMOLED" }, { display_tech: "IPS LCD" }]);
    expect(conflicting.conflicted).toEqual(["display_tech"]);
  });

  it("drops a key only one run reported as uncorroborated", () => {
    const result = reconcileRuns(schema, [{ battery_mah: "5000mAh" }, {}]);
    expect(result.agreed).toEqual([]);
    expect(result.uncorroborated).toEqual(["battery_mah"]);
  });

  it("ignores unparseable values entirely rather than treating them as agreement", () => {
    const result = reconcileRuns(schema, [{ battery_mah: "huge" }, { battery_mah: "massive" }]);
    expect(result).toEqual({ agreed: [], conflicted: [], uncorroborated: [] });
  });

  it("ignores keys not in the schema", () => {
    const result = reconcileRuns(schema, [{ not_a_key: "x" }, { not_a_key: "x" }]);
    expect(result.agreed).toEqual([]);
    expect(result.uncorroborated).toEqual([]);
  });
});
