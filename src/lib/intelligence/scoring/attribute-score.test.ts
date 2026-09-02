import { describe, expect, it } from "vitest";
import { scoreAttributeValue } from "./attribute-score";
import { getCategorySchema, getAttribute } from "@/lib/intelligence/schema";

const schema = getCategorySchema("smartphone")!;
const attr = (key: string) => getAttribute(schema, key)!;

describe("scoreAttributeValue", () => {
  it("scores a boolean attribute as 100/0", () => {
    expect(scoreAttributeValue(attr("main_cam_ois"), "true")).toBe(100);
    expect(scoreAttributeValue(attr("main_cam_ois"), "false")).toBe(0);
  });

  it("scores a ranked enum by position, best first", () => {
    const ipRating = attr("ip_rating");
    expect(scoreAttributeValue(ipRating, "IP69")).toBe(100); // best in enumRank
    expect(scoreAttributeValue(ipRating, "None")).toBe(0); // worst
    expect(scoreAttributeValue(ipRating, "IP68")).toBeCloseTo((100 * 5) / 6, 5);
  });

  it("returns null for an enum value not in the ranking, rather than guessing", () => {
    expect(scoreAttributeValue(attr("ip_rating"), "IP99")).toBeNull();
  });

  it("scores a numeric attribute against its band", () => {
    expect(scoreAttributeValue(attr("battery_mah"), "6000")).toBe(100);
    expect(scoreAttributeValue(attr("battery_mah"), "3000")).toBe(0);
  });

  it("scores a lower-is-better numeric attribute correctly", () => {
    expect(scoreAttributeValue(attr("weight_g"), "150")).toBe(100);
    expect(scoreAttributeValue(attr("weight_g"), "240")).toBe(0);
  });

  it("scores a chipset via the lookup table", () => {
    expect(scoreAttributeValue(attr("chipset"), "Snapdragon 8 Gen 3")).toBe(98);
  });

  it("returns null for an unrecognised chipset rather than estimating one", () => {
    expect(scoreAttributeValue(attr("chipset"), "SuperChip 9000")).toBeNull();
  });

  it("returns null for an unparseable numeric value", () => {
    expect(scoreAttributeValue(attr("battery_mah"), "not-a-number")).toBeNull();
  });

  it("returns null for a non-scoring attribute", () => {
    expect(scoreAttributeValue(attr("build_materials"), "Titanium")).toBeNull();
  });
});
