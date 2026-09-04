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
  refresh_rate_hz: { worst: 60, best: 144 }, // 60Hz is the old standard floor; 144Hz is current high-refresh ceiling; shared across smartphone/laptop schemas — the same numbers mean the same thing on either screen
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

  // --- Laptop-scale attributes ------------------------------------------
  // Given their own keys (`laptop_*`) rather than reusing e.g. `ram_gb` or
  // `weight_g`: a laptop's 16-64GB RAM or 1.1-2.5kg weight sits on a
  // completely different scale than a phone's, and NUMERIC_BANDS is one flat
  // namespace keyed by attribute — sharing a key would silently apply the
  // wrong scale to whichever category scores second.
  laptop_ram_gb: { worst: 8, best: 64 },
  laptop_storage_gb: { worst: 256, best: 2048 },
  laptop_display_ppi: { worst: 110, best: 260 }, // 1080p-on-15.6in ≈140ppi; sharpest current Retina/OLED laptop panels ≈220-260ppi
  laptop_peak_brightness_nits: { worst: 300, best: 1600 }, // 300 nits is a dim budget panel; ~1000-1600 is current premium HDR peak
  laptop_battery_wh: { worst: 40, best: 100 },
  battery_life_hours: { worst: 6, best: 20 }, // manufacturer-rated video-playback estimate; 6h is a dated budget laptop, ~18-20h is current best-in-class
  laptop_charging_w: { worst: 30, best: 140 },
  thunderbolt_ports: { worst: 0, best: 4 },
  laptop_weight_kg: { worst: 2.5, best: 1.1 }, // lighter is better, so `best` is the lower number
  laptop_webcam_mp: { worst: 0.9, best: 12 }, // 720p ≈0.9MP legacy webcams; current best laptop webcams ≈12MP
  laptop_os_update_years: { worst: 0, best: 8 }, // Apple's macOS support for a given Mac typically runs ~7-8 years

  // --- Tablet-scale attributes -------------------------------------------
  // Own keys for the same reason as the laptop_* bands above: a tablet's RAM,
  // battery, camera and weight ranges sit between a phone's and a laptop's,
  // not on either one.
  tablet_ram_gb: { worst: 3, best: 16 },
  tablet_storage_gb: { worst: 64, best: 1024 },
  tablet_display_ppi: { worst: 220, best: 270 }, // most current tablets cluster tightly around ~260-264ppi regardless of price tier
  tablet_peak_brightness_nits: { worst: 400, best: 1600 },
  tablet_main_cam_mp: { worst: 5, best: 12 }, // tablet rear cameras are a secondary feature; even flagship tablets rarely exceed 12MP
  tablet_front_cam_mp: { worst: 5, best: 12 },
  tablet_battery_wh: { worst: 20, best: 40 },
  tablet_charging_w: { worst: 5, best: 30 },
  tablet_weight_g: { worst: 700, best: 400 }, // lighter is better, so `best` is the lower number

  // --- Audio (headphones/earbuds) attributes ------------------------------
  driver_size_mm: { worst: 20, best: 50 },
  audio_mic_count: { worst: 1, best: 8 },
  audio_battery_life_hours: { worst: 15, best: 40 }, // rated with ANC on, where the device has ANC
  audio_weight_g: { worst: 350, best: 200 }, // lighter is better, so `best` is the lower number

  // --- Camera (dedicated, interchangeable-lens) attributes ----------------
  // `camera_sensor_mp` is deliberately its own key rather than reusing a
  // phone's `main_cam_mp`: a 24MP APS-C sensor outresolves a 108MP phone
  // sensor in real image quality because its individual pixels are so much
  // larger, so scoring it on the phone-camera-megapixel scale would rank it
  // backwards.
  camera_sensor_mp: { worst: 12, best: 45 },
  camera_iso_max: { worst: 6400, best: 102400 },
  camera_af_points: { worst: 9, best: 800 },
  camera_burst_fps: { worst: 3, best: 20 },
  camera_screen_dots: { worst: 230000, best: 2100000 },
  camera_viewfinder_dots: { worst: 1000000, best: 5760000 },
  camera_shots_per_charge: { worst: 200, best: 700 },
  camera_weight_g: { worst: 700, best: 350 }, // lighter is better, so `best` is the lower number
  camera_card_slots: { worst: 1, best: 2 },
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

/**
 * Coarse relative performance tier, 0-100, for laptop CPUs — same idea as
 * CHIPSET_PERFORMANCE_INDEX above but a deliberately separate table and
 * scale: a laptop chip and a phone SoC are not comparable on one line, and
 * scoreAttributeValue() picks the table by attribute key (see
 * TEXT_LOOKUP_TABLES below) precisely so the two scales never mix.
 */
export const LAPTOP_CPU_PERFORMANCE_INDEX: Record<string, number> = {
  // Apple Silicon
  "M4 Max": 100,
  "M4 Pro": 93,
  M4: 82,
  "M3 Max": 96,
  "M3 Pro": 88,
  M3: 78,
  "M2 Max": 90,
  "M2 Pro": 84,
  M2: 70,
  "M1 Max": 80,
  "M1 Pro": 72,
  M1: 58,

  // Intel Core Ultra (Meteor Lake / Lunar Lake / Arrow Lake generations)
  "Core Ultra 9 285H": 91,
  "Core Ultra 9 185H": 85,
  "Core Ultra 7 155H": 74,
  "Core Ultra 7 165H": 76,
  "Core Ultra 5 125H": 60,

  // AMD Ryzen (mobile H/HS/U series)
  "Ryzen 9 8945HS": 87,
  "Ryzen 9 7940HS": 83,
  "Ryzen 7 8845HS": 71,
  "Ryzen 7 7840U": 65,
  "Ryzen 5 7640U": 50,
};

/**
 * Which lookup table (if any) scores a `text`-typed attribute's normalized
 * value, keyed by the attribute's own key so two categories can each define a
 * "main chip" attribute without sharing a scale. See scoreAttributeValue().
 */
export const TEXT_LOOKUP_TABLES: Record<string, Record<string, number>> = {
  chipset: CHIPSET_PERFORMANCE_INDEX,
  cpu: LAPTOP_CPU_PERFORMANCE_INDEX,
};

/** Linear-map `value` between [worst, best] to a 0-100 score, clamped. Direction follows which anchor is larger. */
export function scoreFromBand(value: number, band: { worst: number; best: number }): number {
  const { worst, best } = band;
  if (worst === best) return 50;
  const t = (value - worst) / (best - worst);
  return Math.max(0, Math.min(100, t * 100));
}
