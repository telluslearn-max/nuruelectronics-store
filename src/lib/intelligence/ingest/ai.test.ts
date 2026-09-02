import { describe, expect, it } from "vitest";
import { buildResearchPrompt, parseResearchResponse } from "./ai";
import { getCategorySchema } from "@/lib/intelligence/schema";

const schema = getCategorySchema("smartphone")!;

describe("buildResearchPrompt", () => {
  it("names the exact product and lists every schema attribute", () => {
    const prompt = buildResearchPrompt(schema, { title: "Galaxy S25 Ultra", vendor: "Samsung" });
    expect(prompt).toContain("Galaxy S25 Ultra");
    expect(prompt).toContain("Samsung");
    expect(prompt).toContain("battery_mah");
    expect(prompt).toContain("chipset");
    expect(prompt).toMatch(/omit/i);
  });
});

describe("parseResearchResponse", () => {
  it("parses a clean JSON object and lifts out sources as citations", () => {
    const text = JSON.stringify({
      battery_mah: "5000 mAh",
      chipset: "Snapdragon 8 Gen 3",
      sources: ["https://www.gsmarena.com/samsung_galaxy_s25_ultra-13000.php"],
    });
    const result = parseResearchResponse(text, schema);
    expect(result.run).toEqual({ battery_mah: "5000 mAh", chipset: "Snapdragon 8 Gen 3" });
    expect(result.citations).toEqual(["https://www.gsmarena.com/samsung_galaxy_s25_ultra-13000.php"]);
  });

  it("strips a ```json fence and leading prose", () => {
    const text = `Here is what I found:\n\`\`\`json\n{"battery_mah": "5000 mAh"}\n\`\`\``;
    expect(parseResearchResponse(text, schema).run).toEqual({ battery_mah: "5000 mAh" });
  });

  it("drops keys that aren't in the schema", () => {
    const text = JSON.stringify({ battery_mah: "5000 mAh", made_up_field: "nonsense" });
    expect(parseResearchResponse(text, schema).run).toEqual({ battery_mah: "5000 mAh" });
  });

  it("returns empty on unparseable or non-object responses", () => {
    expect(parseResearchResponse("I couldn't find reliable specs.", schema)).toEqual({ run: {}, citations: [] });
    expect(parseResearchResponse("{not json", schema)).toEqual({ run: {}, citations: [] });
  });

  it("coerces number/boolean scalars to strings and drops non-URL source entries", () => {
    const text = JSON.stringify({ ram_gb: 12, main_cam_ois: true, sources: ["not-a-url", "https://ok.example/x"] });
    const result = parseResearchResponse(text, schema);
    expect(result.run).toEqual({ ram_gb: "12", main_cam_ois: "true" });
    expect(result.citations).toEqual(["https://ok.example/x"]);
  });
});
