import type { CategorySchema } from "@/lib/intelligence/types";

/**
 * The audio category schema — over-ear/on-ear headphones and earbuds. Same
 * role as `smartphone.ts`.
 *
 * Headphones have no camera or screen, so those two NURU Score components
 * are never scored here (they still appear in `componentWeights`, unscored,
 * the same way `smartphone.ts` leaves `value` unscored — see nuru-score.ts:
 * a component with no scoring attribute just never contributes to the
 * composite, it isn't penalised). `performance` is repurposed as "how good
 * the audio itself is" (driver, codecs) rather than a chip, and `features`
 * carries ANC/mic/multipoint — the attributes that actually differentiate
 * one pair of headphones from another.
 */
export const audioSchema: CategorySchema = {
  id: "audio",
  label: "Headphones",
  shopifyProductTypes: ["Audio"],
  groups: [
    { id: "audio", label: "Audio" },
    { id: "features", label: "Noise Cancelling & Controls" },
    { id: "battery", label: "Battery & Charging" },
    { id: "build", label: "Build & Design" },
    { id: "software", label: "Software" },
  ],
  componentWeights: {
    performance: 0.32,
    features: 0.22,
    battery: 0.22,
    build: 0.14,
    software: 0.04,
    camera: 0.02,
    display: 0.02,
    value: 0.02,
  },
  attributes: [
    // --- Audio ----------------------------------------------------------
    {
      key: "driver_size_mm",
      label: "Driver size",
      hint: "Larger drivers generally move more air, which tends to mean fuller bass — but tuning matters as much as size.",
      valueType: "number",
      unit: "mm",
      normalizer: "quantity",
      group: "audio",
      scoring: { component: "performance", weight: 1.5, higherIsBetter: true },
    },
    {
      key: "freq_response_low_hz",
      label: "Frequency response (low)",
      valueType: "integer",
      unit: "hz",
      normalizer: "quantity",
      group: "audio",
    },
    {
      key: "freq_response_high_hz",
      label: "Frequency response (high)",
      valueType: "integer",
      unit: "hz",
      normalizer: "quantity",
      group: "audio",
    },
    {
      key: "hi_res_audio",
      label: "Hi-Res Audio certified",
      hint: "A wired or LDAC/aptX HD connection can carry more detail than standard Bluetooth.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "audio",
      scoring: { component: "performance", weight: 1.5, higherIsBetter: true },
    },
    {
      key: "supports_ldac",
      label: "LDAC",
      hint: "Sony's high-bitrate Bluetooth codec — noticeably better quality than standard SBC/AAC on a supporting phone.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "audio",
      scoring: { component: "performance", weight: 1, higherIsBetter: true },
    },
    {
      key: "supports_aptx",
      label: "aptX",
      hint: "Qualcomm's high-quality Bluetooth codec family — mainly benefits Android phones that support it.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "audio",
      scoring: { component: "performance", weight: 1, higherIsBetter: true },
    },
    // --- Noise cancelling & controls --------------------------------------
    {
      key: "anc",
      label: "Active noise cancelling",
      hint: "Electronically cancels ambient noise rather than just blocking it physically. The single biggest differentiator for commuting/travel use.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "features",
      scoring: { component: "features", weight: 3, higherIsBetter: true },
    },
    {
      key: "transparency_mode",
      label: "Transparency/ambient mode",
      hint: "Pipes outside sound back in without taking the headphones off — useful for hearing announcements or having a conversation.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "features",
      scoring: { component: "features", weight: 1, higherIsBetter: true },
    },
    {
      key: "audio_mic_count",
      label: "Microphones",
      hint: "More microphones generally means better noise cancelling and clearer calls.",
      valueType: "integer",
      unit: "count",
      normalizer: "quantity",
      group: "features",
      scoring: { component: "features", weight: 1, higherIsBetter: true },
    },
    {
      key: "multipoint",
      label: "Multipoint pairing",
      hint: "Stay connected to two devices at once, e.g. a laptop and a phone, and switch between them automatically.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "features",
      scoring: { component: "features", weight: 1, higherIsBetter: true },
    },
    {
      key: "touch_controls",
      label: "Touch controls",
      valueType: "boolean",
      normalizer: "boolean",
      group: "features",
      scoring: { component: "features", weight: 0.5, higherIsBetter: true },
    },
    {
      key: "wired_listening",
      label: "Wired listening",
      hint: "Whether a 3.5mm cable can be used when the battery is dead.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "features",
      scoring: { component: "features", weight: 0.5, higherIsBetter: true },
    },
    {
      key: "companion_app",
      label: "Companion app",
      valueType: "text",
      normalizer: "passthrough",
      group: "features",
    },
    // --- Battery -----------------------------------------------------
    {
      key: "audio_battery_life_hours",
      label: "Battery life (ANC on)",
      hint: "Manufacturer-rated playback time with noise cancelling on. Real-world life is usually somewhat lower.",
      valueType: "number",
      unit: "hours",
      normalizer: "quantity",
      group: "battery",
      scoring: { component: "battery", weight: 4, higherIsBetter: true },
    },
    {
      key: "quick_charge",
      label: "Quick charge",
      hint: "Extra playback time from a few minutes on charge.",
      valueType: "text",
      normalizer: "passthrough",
      group: "battery",
    },
    {
      key: "charging_port",
      label: "Charging port",
      valueType: "enum",
      normalizer: "enum",
      enumValues: ["Micro-USB", "USB-C"],
      group: "battery",
    },
    // --- Build ----------------------------------------------------
    {
      key: "audio_weight_g",
      label: "Weight",
      hint: "Lighter is more comfortable for long listening sessions.",
      valueType: "number",
      unit: "g",
      normalizer: "quantity",
      group: "build",
      scoring: { component: "build", weight: 2, higherIsBetter: false },
    },
    {
      key: "foldable",
      label: "Folds flat for storage",
      valueType: "boolean",
      normalizer: "boolean",
      group: "build",
      scoring: { component: "build", weight: 1, higherIsBetter: true },
    },
    {
      key: "ip_rating",
      label: "Water/sweat resistance",
      hint: "An IP or IPX rating means the manufacturer tested and certified it; no rating doesn't necessarily mean it's fragile, just unrated.",
      valueType: "enum",
      normalizer: "enum",
      enumValues: ["None", "IPX2", "IPX4", "IPX5"],
      enumRank: ["IPX5", "IPX4", "IPX2", "None"],
      group: "build",
      scoring: { component: "build", weight: 1, higherIsBetter: true },
    },
    {
      key: "build_materials",
      label: "Materials",
      valueType: "text",
      normalizer: "passthrough",
      group: "build",
    },
    // --- Software ------------------------------------------------
    {
      key: "firmware_updatable",
      label: "Firmware updates",
      hint: "Whether the maker can improve ANC tuning, add codecs or fix bugs after purchase via the companion app.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "software",
      scoring: { component: "software", weight: 1, higherIsBetter: true },
    },
  ],
};
