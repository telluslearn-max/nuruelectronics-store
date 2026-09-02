import { describe, expect, it } from "vitest";
import type { SpecConfidence } from "@prisma/client";
import { buildComparison, type CompareInputProduct } from "./compare";
import { getCategorySchema } from "@/lib/intelligence/schema";

const schema = getCategorySchema("smartphone")!;

function spec(normalizedValue: string, confidence: SpecConfidence = "low") {
  return { normalizedValue, rawValue: normalizedValue, unit: null, confidence };
}

const pixel: CompareInputProduct = {
  handle: "pixel-9a",
  specs: new Map([
    ["battery_mah", spec("5000")],
    ["main_cam_mp", spec("64")],
    ["refresh_rate_hz", spec("120")],
    ["sim_config", spec("Dual SIM")],
  ]),
  components: { camera: 90, battery: 85, performance: 70 },
  composite: 82,
};

const samsung: CompareInputProduct = {
  handle: "galaxy-s25",
  specs: new Map([
    ["battery_mah", spec("4000")],
    ["main_cam_mp", spec("50")],
    ["refresh_rate_hz", spec("120")],
    ["sim_config", spec("eSIM + physical")],
  ]),
  components: { camera: 82, battery: 78, performance: 92 },
  composite: 84,
};

describe("buildComparison", () => {
  const result = buildComparison([pixel, samsung], schema);

  it("marks the per-attribute winner from a real scoreable difference", () => {
    const batteryRow = result.groups
      .flatMap((g) => g.rows)
      .find((r) => r.key === "battery_mah")!;
    expect(batteryRow.winners).toEqual([0]); // pixel, higher mAh
  });

  it("declares no winner when a scoreable attribute is a dead heat", () => {
    const refreshRow = result.groups.flatMap((g) => g.rows).find((r) => r.key === "refresh_rate_hz")!;
    expect(refreshRow.winners).toEqual([]);
  });

  it("shows a non-scoreable attribute with both values and no winner", () => {
    const simRow = result.groups.flatMap((g) => g.rows).find((r) => r.key === "sim_config")!;
    expect(simRow.winners).toEqual([]);
    expect(simRow.cells.map((c) => c?.normalizedValue)).toEqual(["Dual SIM", "eSIM + physical"]);
  });

  it("omits a spec row that fewer than two products have", () => {
    const withLonelySpec: CompareInputProduct = { ...pixel, specs: new Map([...pixel.specs, ["ip_rating", spec("IP68")]]) };
    const r = buildComparison([withLonelySpec, samsung], schema);
    expect(r.groups.flatMap((g) => g.rows).some((row) => row.key === "ip_rating")).toBe(false);
  });

  it("ranks component scores and summarises who leads each", () => {
    const perf = result.components.find((c) => c.component === "performance")!;
    expect(perf.winners).toEqual([1]); // samsung
    const cameraSummary = result.summary.find((s) => s.component === "camera")!;
    expect(cameraSummary.leaderHandle).toBe("pixel-9a");
    expect(cameraSummary.margin).toBe(8);
  });

  it("picks the composite winner", () => {
    expect(result.compositeWinners).toEqual([1]); // samsung 84 > pixel 82
  });
});
