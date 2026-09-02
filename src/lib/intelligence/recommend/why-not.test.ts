import { describe, expect, it } from "vitest";
import { rankByFit } from "./rank";
import { explainWhyNot } from "./why-not";

describe("explainWhyNot", () => {
  const weights = { camera: 4, battery: 3, display: 2, performance: 1 };
  const ranked = rankByFit(
    [
      { handle: "pixel-9a", components: { camera: 93, battery: 93, display: 74, performance: 78 } },
      { handle: "galaxy-s25", components: { camera: 82, battery: 84, display: 90, performance: 92 } },
    ],
    weights,
  );
  const winner = ranked.find((r) => r.handle === "pixel-9a")!;
  const rejected = ranked.find((r) => r.handle === "galaxy-s25")!;

  it("splits which side wins which components", () => {
    const result = explainWhyNot(rejected, winner, weights);
    expect(result.rejectedWinsOn.sort()).toEqual(["display", "performance"]);
    expect(result.winnerWinsOn.sort()).toEqual(["battery", "camera"]);
  });

  it("flags that the winner's wins are the ones the shopper weighted most", () => {
    const result = explainWhyNot(rejected, winner, weights);
    expect(result.winnerWinsOnWeighted.sort()).toEqual(["battery", "camera"]);
  });

  it("reports the Fit Score gap in the winner's favour", () => {
    const result = explainWhyNot(rejected, winner, weights);
    expect(result.fitScoreGap).toBeGreaterThan(0);
    expect(result.fitScoreGap).toBeCloseTo(winner.fitScore! - rejected.fitScore!, 2);
  });

  it("treats a sub-8-point component difference as a wash", () => {
    const close = rankByFit(
      [
        { handle: "a", components: { camera: 80, battery: 82 } },
        { handle: "b", components: { camera: 84, battery: 78 } },
      ],
      { camera: 1, battery: 1 },
    );
    const result = explainWhyNot(close[1], close[0], { camera: 1, battery: 1 });
    expect(result.rejectedWinsOn).toEqual([]);
    expect(result.winnerWinsOn).toEqual([]);
  });
});
