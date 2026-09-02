import { describe, expect, it } from "vitest";
import { computeCompleteness } from "./completeness";
import { getCategorySchema } from "@/lib/intelligence/schema";

const schema = getCategorySchema("smartphone")!;

describe("computeCompleteness", () => {
  it("is 0 with no keys and 1 when every attribute is present", () => {
    expect(computeCompleteness(schema, [])).toBe(0);
    expect(computeCompleteness(schema, schema.attributes.map((a) => a.key))).toBe(1);
  });

  it("ignores duplicate keys and keys outside the schema", () => {
    const withDupes = computeCompleteness(schema, ["chipset", "chipset", "not_a_real_key"]);
    const withoutDupes = computeCompleteness(schema, ["chipset"]);
    expect(withDupes).toBe(withoutDupes);
    expect(withDupes).toBeCloseTo(1 / schema.attributes.length, 3);
  });
});
