import { describe, expect, it } from "vitest";
import { rankByFit } from "./rank";
import { explainRecommendation } from "./explain";

describe("explainRecommendation", () => {
  const weights = { camera: 4, battery: 3, value: 2, performance: 1 };
  const [pick] = rankByFit(
    [{ handle: "pixel-9a", components: { camera: 92, battery: 88, value: 60, performance: 40 } }],
    weights,
  );

  it("names weighted components that score well as strengths and poorly as weaknesses", () => {
    const rec = explainRecommendation(pick, weights);
    expect(rec.strengths.sort()).toEqual(["battery", "camera"]);
    expect(rec.weaknesses).toEqual(["performance"]);
    expect(rec.handle).toBe("pixel-9a");
    expect(rec.fitScore).toBe(pick.fitScore);
  });

  it("identifies the heaviest-weighted components as the primary reason", () => {
    const rec = explainRecommendation(pick, weights);
    expect(rec.primaryDrivers[0]).toBe("camera"); // highest weight
    expect(rec.primaryDrivers).toContain("battery");
    expect(rec.primaryDrivers).not.toContain("performance"); // lowest weight, not a driver
  });

  it("only considers components the shopper actually weighted", () => {
    const [displayIgnored] = rankByFit(
      [{ handle: "x", components: { camera: 90, display: 95 } }],
      { camera: 1 },
    );
    const rec = explainRecommendation(displayIgnored, { camera: 1 });
    expect(rec.strengths).toEqual(["camera"]);
    expect([...rec.strengths, ...rec.weaknesses]).not.toContain("display");
  });
});
