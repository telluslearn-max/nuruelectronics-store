import { describe, expect, it } from "vitest";
import { normalizeRecord, normalizeSpec } from "./normalize";
import type { SpecAttribute } from "./types";

const attr = (over: Partial<SpecAttribute>): SpecAttribute => ({
  key: "x",
  label: "X",
  valueType: "number",
  normalizer: "quantity",
  group: "g",
  ...over,
});

describe("normalizeSpec — quantity", () => {
  const refreshRate = attr({ key: "refresh_rate_hz", unit: "hz", normalizer: "quantity" });

  it("reads every spelling of a refresh rate as the same number", () => {
    for (const raw of ["120Hz", "120 Hz", "120hz refresh rate", "up to 120 Hz", "120"]) {
      expect(normalizeSpec(refreshRate, raw)).toEqual({ normalizedValue: "120", unit: "hz" });
    }
  });

  it("keeps a decimal and strips thousands separators", () => {
    expect(normalizeSpec(attr({ unit: "in" }), "6.70 inches")).toEqual({ normalizedValue: "6.7", unit: "in" });
    expect(normalizeSpec(attr({ unit: "mah" }), "5,000 mAh")).toEqual({ normalizedValue: "5000", unit: "mah" });
  });

  it("tolerates approximation marks", () => {
    expect(normalizeSpec(attr({ unit: "in" }), "≈6.1")).toEqual({ normalizedValue: "6.1", unit: "in" });
  });

  it("returns a null value (not null result) when there is text but no number", () => {
    expect(normalizeSpec(refreshRate, "adaptive")).toEqual({ normalizedValue: null, unit: "hz" });
  });

  it("returns null for blank and explicit no-data markers", () => {
    for (const raw of ["", "  ", "-", "—", "N/A", "TBD", "unknown"]) {
      expect(normalizeSpec(refreshRate, raw)).toBeNull();
    }
  });
});

describe("normalizeSpec — storage", () => {
  const storage = attr({ key: "storage_gb", unit: "gb", normalizer: "storage", valueType: "integer" });

  it("resolves GB, TB and MB to whole gigabytes", () => {
    expect(normalizeSpec(storage, "256GB")).toEqual({ normalizedValue: "256", unit: "gb" });
    expect(normalizeSpec(storage, "1 TB")).toEqual({ normalizedValue: "1024", unit: "gb" });
    expect(normalizeSpec(storage, "512 MB")).toEqual({ normalizedValue: "1", unit: "gb" });
    expect(normalizeSpec(storage, "8")).toEqual({ normalizedValue: "8", unit: "gb" });
  });
});

describe("normalizeSpec — boolean", () => {
  const nfc = attr({ key: "nfc", valueType: "boolean", normalizer: "boolean" });

  it("maps common truthy and falsy spellings", () => {
    for (const raw of ["Yes", "yes", "✓", "true", "supported", "Yes, 45W"]) {
      expect(normalizeSpec(nfc, raw)).toEqual({ normalizedValue: "true", unit: null });
    }
    for (const raw of ["No", "✗", "none", "not supported", "No wireless"]) {
      expect(normalizeSpec(nfc, raw)).toEqual({ normalizedValue: "false", unit: null });
    }
  });

  it("treats 'Optional' as unknown, not a feature", () => {
    expect(normalizeSpec(nfc, "Optional")).toEqual({ normalizedValue: null, unit: null });
  });
});

describe("normalizeSpec — enum", () => {
  const panel = attr({
    key: "display_tech",
    valueType: "enum",
    normalizer: "enum",
    enumValues: ["LCD", "IPS LCD", "OLED", "AMOLED", "LTPO OLED"],
  });

  it("canonicalises panel synonyms", () => {
    expect(normalizeSpec(panel, "Super AMOLED")?.normalizedValue).toBe("AMOLED");
    expect(normalizeSpec(panel, "Dynamic AMOLED 2X")?.normalizedValue).toBe("AMOLED");
    expect(normalizeSpec(panel, "LTPO AMOLED")?.normalizedValue).toBe("LTPO OLED");
    expect(normalizeSpec(panel, "ips lcd")?.normalizedValue).toBe("IPS LCD");
  });

  it("matches an allowed token embedded in a longer phrase", () => {
    const net = attr({ key: "cellular", valueType: "enum", normalizer: "enum", enumValues: ["3G", "4G", "5G"] });
    expect(normalizeSpec(net, "5G (sub-6)")?.normalizedValue).toBe("5G");
  });

  it("keeps an unrecognised value rather than dropping it", () => {
    expect(normalizeSpec(panel, "MicroLED")?.normalizedValue).toBe("MicroLED");
  });
});

describe("normalizeSpec — chipset", () => {
  const chipset = attr({ key: "chipset", valueType: "text", normalizer: "chipset" });

  it("collapses vendor prefixes and abbreviations to one canonical name", () => {
    for (const raw of ["Snapdragon 8 Gen 3", "Qualcomm Snapdragon 8 Gen 3", "SD 8 Gen 3"]) {
      expect(normalizeSpec(chipset, raw)?.normalizedValue).toBe("Snapdragon 8 Gen 3");
    }
  });

  it("drops parenthetical fab notes", () => {
    expect(normalizeSpec(chipset, "Dimensity 9300 (4 nm)")?.normalizedValue).toBe("Dimensity 9300");
  });
});

describe("normalizeSpec — resolution", () => {
  const res = attr({ key: "display_resolution", valueType: "text", normalizer: "resolution" });

  it("normalises the separator and drops the word pixels", () => {
    expect(normalizeSpec(res, "2340 x 1080 pixels")?.normalizedValue).toBe("2340x1080");
    expect(normalizeSpec(res, "3200×1440")?.normalizedValue).toBe("3200x1440");
  });

  it("returns a null value when no WxH pair is present", () => {
    expect(normalizeSpec(res, "FHD+")).toEqual({ normalizedValue: null, unit: null });
  });
});

describe("normalizeRecord", () => {
  const attributes: SpecAttribute[] = [
    attr({ key: "refresh_rate_hz", unit: "hz", normalizer: "quantity" }),
    attr({ key: "battery_mah", unit: "mah", normalizer: "quantity" }),
    attr({ key: "nfc", valueType: "boolean", normalizer: "boolean" }),
  ];

  it("normalises known keys, skips blanks and unknown keys", () => {
    const out = normalizeRecord(attributes, {
      refresh_rate_hz: "120 Hz",
      battery_mah: "",
      nfc: "Yes",
      colour: "Midnight Black", // not in schema
    });
    expect([...out.keys()].sort()).toEqual(["nfc", "refresh_rate_hz"]);
    expect(out.get("refresh_rate_hz")).toEqual({
      rawValue: "120 Hz",
      normalized: { normalizedValue: "120", unit: "hz" },
    });
  });

  it("skips a value that normalises to a no-data marker but keeps an unparseable one", () => {
    const out = normalizeRecord(attributes, { refresh_rate_hz: "N/A", battery_mah: "big" });
    expect(out.has("refresh_rate_hz")).toBe(false);
    expect(out.get("battery_mah")?.normalized.normalizedValue).toBeNull();
  });
});
