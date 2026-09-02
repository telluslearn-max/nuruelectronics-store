import { describe, expect, it } from "vitest";
import { parseSearchIntent } from "./intent";

describe("parseSearchIntent", () => {
  it("translates 'best gaming phone under 40k' into structured filters", () => {
    const intent = parseSearchIntent("best gaming phone under 40k");
    expect(intent.categoryId).toBe("smartphone");
    expect(intent.budgetMax).toBe(40000);
    expect(intent.weights.performance).toBeGreaterThan(0);
    expect(intent.weights.performance!).toBeGreaterThanOrEqual(intent.weights.value ?? 0);
    expect(intent.freeText).not.toMatch(/gaming|phone|under|best/);
  });

  it("parses a variety of budget phrasings to whole shillings", () => {
    expect(parseSearchIntent("phone under KSh 50,000").budgetMax).toBe(50000);
    expect(parseSearchIntent("phone around 30k").budgetMax).toBe(30000);
    expect(parseSearchIntent("phones over 60000").budgetMin).toBe(60000);
    const range = parseSearchIntent("phone 40k to 60k");
    expect([range.budgetMin, range.budgetMax]).toEqual([40000, 60000]);
  });

  it("recognises a brand and normalises sub-brands to the parent", () => {
    expect(parseSearchIntent("samsung phone for photography").brand).toBe("Samsung");
    expect(parseSearchIntent("iphone with good battery").brand).toBe("Apple");
    expect(parseSearchIntent("pixel for photos").brand).toBe("Google");
  });

  it("accumulates weights when several intents are stated", () => {
    const intent = parseSearchIntent("phone for photography and gaming");
    expect(intent.weights.camera).toBeGreaterThan(0);
    expect(intent.weights.performance).toBeGreaterThan(0);
  });

  it("returns empty structure for a bare model search", () => {
    const intent = parseSearchIntent("Galaxy A56");
    expect(intent.categoryId).toBeNull();
    expect(intent.budgetMax).toBeNull();
    expect(intent.weights).toEqual({});
    expect(intent.freeText).toBe("galaxy a56");
  });
});
