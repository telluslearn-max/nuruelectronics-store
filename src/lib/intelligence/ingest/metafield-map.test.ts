import { describe, expect, it } from "vitest";
import { mapMetafields } from "./metafield-map";

describe("mapMetafields", () => {
  it("maps clean 1:1 metafields and normalizes them", () => {
    const out = mapMetafields("smartphone", [
      { key: "processor", value: "Snapdragon 8 Gen 2" },
      { key: "ram", value: "8GB" },
      { key: "storage", value: "256GB" },
    ]);
    expect(out.find((v) => v.key === "chipset")?.normalizedValue).toBe("Snapdragon 8 Gen 2");
    expect(out.find((v) => v.key === "ram_gb")).toEqual({
      key: "ram_gb",
      rawValue: "8GB",
      normalizedValue: "8",
      unit: "gb",
    });
    expect(out.find((v) => v.key === "storage_gb")?.normalizedValue).toBe("256");
  });

  it("drops metafields with no safe mapping (battery, connectivity, dimensions)", () => {
    const out = mapMetafields("smartphone", [
      { key: "battery", value: "Up to 23h video playback" },
      { key: "connectivity", value: "Bluetooth 5.2" },
      { key: "dimensions", value: "160 x 76 x 8mm" },
    ]);
    expect(out).toEqual([]);
  });

  it("drops a mapped metafield that doesn't normalize to anything", () => {
    const out = mapMetafields("smartphone", [{ key: "processor", value: "N/A" }]);
    expect(out).toEqual([]);
  });

  it("returns nothing for an unknown category", () => {
    expect(mapMetafields("toaster", [{ key: "processor", value: "X" }])).toEqual([]);
  });

  it("keeps only the first value for a schema key that two metafields map to", () => {
    // Not expected in practice, but the function should stay deterministic if it happens.
    const out = mapMetafields("smartphone", [
      { key: "processor", value: "Chip A" },
      { key: "processor", value: "Chip B" },
    ]);
    expect(out.filter((v) => v.key === "chipset")).toHaveLength(1);
    expect(out[0].rawValue).toBe("Chip A");
  });
});
