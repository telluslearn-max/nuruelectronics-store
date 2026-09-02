/**
 * Reference data for the NURU Score engine — the only place numbers are
 * "invented" rather than derived, and it's invented in the ordinary sense that
 * any grading scale is: a judgement call about what counts as a 0 and what
 * counts as a 100, made once, in the open, and applied identically to every
 * product. Nothing here is per-product; nothing here is written by a model.
 *
 * Two kinds of reference:
 *
 *   NUMERIC_BANDS   worst/best anchors a raw number is linearly mapped
 *                    between (clamped). `best` can be lower than `worst`
 *                    for attributes where smaller is better (weight_g) —
 *                    the direction lives entirely in which anchor is which.
 *
 *   CHIPSET_PERFORMANCE_INDEX   a coarse 0-100 tier for named chipsets. A chip
 *                    not in the table scores as unknown (null) — never
 *                    estimated from its name — until a BenchmarkObservation
 *                    (a later PR) gives it a measured number instead.
 */

export const NUMERIC_BANDS: Record<string, { worst: number; best: number }> = {
  // Display
  display_ppi: { worst: 260, best: 520 }, // budget 720p-on-6.5in ≈260ppi; sharpest current flagships ≈500-520ppi
  refresh_rate_hz: { worst: 60, best: 144 }, // 60Hz is the old standard floor; 144Hz is current high-refresh ceiling
  peak_brightness_nits: { worst: 500, best: 3000 }, // 500 nits struggles outdoors; ~2500-3000 is current flagship peak (HBM)

  // Performance
  ram_gb: { worst: 4, best: 16 },

  // Memory / features
  storage_gb: { worst: 32, best: 512 },

  // Camera
  main_cam_mp: { worst: 12, best: 108 },
  ultrawide_mp: { worst: 5, best: 50 },
  telephoto_mp: { worst: 2, best: 50 },
  telephoto_zoom_x: { worst: 2, best: 10 },
  front_cam_mp: { worst: 5, best: 40 },

  // Battery
  battery_mah: { worst: 3000, best: 6000 },
  charging_wired_w: { worst: 10, best: 120 },
  charging_wireless_w: { worst: 0, best: 50 },

  // Build — lighter is better, so `best` is the lower number.
  weight_g: { worst: 240, best: 150 },

  // Software
  os_update_years: { worst: 0, best: 7 }, // Google/Samsung's longest current commitments are ~7 years
  security_update_years: { worst: 0, best: 7 },
};

/**
 * Coarse relative performance tier, 0-100, keyed by the canonical chipset name
 * normalizeChipset() produces. Deliberately not tied to one specific benchmark
 * suite — it's a rough ordering to unblock the performance component before
 * BenchmarkObservation rows (Geekbench/AnTuTu, ingested in a later PR) give a
 * measured number. A later PR should prefer a BenchmarkObservation over this
 * table when both exist for a chip.
 */
export const CHIPSET_PERFORMANCE_INDEX: Record<string, number> = {
  // Qualcomm — current and recent flagship/upper-mid tiers
  "Snapdragon 8 Gen 3": 98,
  "Snapdragon 8 Gen 2": 90,
  "Snapdragon 8 Gen 1": 82,
  "Snapdragon 8+ Gen 1": 86,
  "Snapdragon 7+ Gen 3": 70,
  "Snapdragon 7 Gen 3": 62,
  "Snapdragon 7 Gen 1": 55,
  "Snapdragon 6 Gen 1": 42,
  "Snapdragon 4 Gen 2": 28,

  // MediaTek
  "Dimensity 9300": 97,
  "Dimensity 9200": 88,
  "Dimensity 8300": 68,
  "Dimensity 8200": 63,
  "Dimensity 7200": 50,
  "Dimensity 6100": 30,

  // Samsung
  "Exynos 2400": 89,
  "Exynos 1480": 45,

  // Google
  "Tensor G4": 80,
  "Tensor G3": 75,

  // Apple — indexed on the same 0-100 scale as the Android table above for
  // cross-platform comparison, not on Apple's own generational numbering.
  "A19 Pro": 100,
  "A18 Pro": 97,
  A19: 94,
  A18: 89,
  "A17 Pro": 91,
  "A16 Bionic": 84,
  "A15 Bionic": 76,
  "A14 Bionic": 66,
  "A13 Bionic": 56,
  "A12 Bionic": 46,
  "A11 Bionic": 38,
  Bionic: 55, // unqualified "Bionic" from a source that dropped the generation number
};

/** Linear-map `value` between [worst, best] to a 0-100 score, clamped. Direction follows which anchor is larger. */
export function scoreFromBand(value: number, band: { worst: number; best: number }): number {
  const { worst, best } = band;
  if (worst === best) return 50;
  const t = (value - worst) / (best - worst);
  return Math.max(0, Math.min(100, t * 100));
}
