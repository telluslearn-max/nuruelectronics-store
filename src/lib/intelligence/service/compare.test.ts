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

  it("buckets each product's decisive spec wins into 'The Fork', widest gap first", () => {
    expect(result.fork[1]).toEqual([]); // samsung wins no scoreable spec outright here
    const pixelWins = result.fork[0].map((e) => e.key);
    expect(pixelWins).toContain("battery_mah");
    expect(pixelWins).toContain("main_cam_mp");
    const gaps = result.fork[0].map((e) => e.gap);
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
    expect(result.fork[0].every((e) => e.gap >= 3)).toBe(true);
  });

  it("keeps a spec out of the fork when only one product has a scoreable value", () => {
    const lonely: CompareInputProduct = {
      ...pixel,
      specs: new Map([...pixel.specs, ["weight_g", spec("170")]]),
    };
    const r = buildComparison([lonely, samsung], schema);
    expect(r.fork.flat().some((e) => e.key === "weight_g")).toBe(false);
  });

  it("issues a ruling: the composite leader, what it leads, and the strongest holdout", () => {
    expect(result.ruling).not.toBeNull();
    expect(result.ruling!.pick).toBe(1); // samsung
    expect(result.ruling!.leads).toEqual(["performance"]);
    expect(result.ruling!.holdout).toEqual({ index: 0, leads: ["camera", "battery"] });
  });

  it("issues no ruling when the composite is a tie", () => {
    const tied = buildComparison([pixel, { ...samsung, composite: 82 }], schema);
    expect(tied.ruling).toBeNull();
  });
});

describe("buildComparison works for a non-smartphone category (proves the engine is schema-generic)", () => {
  const laptopSchema = getCategorySchema("laptop")!;

  const macbookPro: CompareInputProduct = {
    handle: "macbook-pro-14-m2",
    specs: new Map([
      ["cpu", spec("M2 Pro")],
      ["laptop_ram_gb", spec("16")],
      ["laptop_weight_kg", spec("1.6")],
    ]),
    components: { performance: 90, display: 85, battery: 70 },
    composite: 85,
  };
  const budgetLaptop: CompareInputProduct = {
    handle: "budget-laptop-14",
    specs: new Map([
      ["cpu", spec("Ryzen 5 7640U")],
      ["laptop_ram_gb", spec("8")],
      ["laptop_weight_kg", spec("1.6")],
    ]),
    components: { performance: 55, display: 60, battery: 80 },
    composite: 63,
  };

  const result = buildComparison([macbookPro, budgetLaptop], laptopSchema);

  it("scores the text-lookup `cpu` attribute through the full pipeline and picks the real winner", () => {
    const cpuRow = result.groups.flatMap((g) => g.rows).find((r) => r.key === "cpu")!;
    expect(cpuRow.winners).toEqual([0]); // M2 Pro outranks Ryzen 5 7640U in LAPTOP_CPU_PERFORMANCE_INDEX
  });

  it("declares no winner on an identical, non-scoreable-difference value", () => {
    const weightRow = result.groups.flatMap((g) => g.rows).find((r) => r.key === "laptop_weight_kg")!;
    expect(weightRow.winners).toEqual([]);
  });

  it("still produces a full ruling for a category other than smartphone", () => {
    expect(result.compositeWinners).toEqual([0]);
    expect(result.ruling).not.toBeNull();
    expect(result.ruling!.pick).toBe(0);
    expect(result.ruling!.holdout).toEqual({ index: 1, leads: ["battery"] });
  });
});
