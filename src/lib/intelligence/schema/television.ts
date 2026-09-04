import type { CategorySchema } from "@/lib/intelligence/types";

/**
 * The television category schema. Same role as `smartphone.ts`.
 *
 * Infrastructure-only for now: this schema is registered so the engine and
 * comparison UI cover the category, but no product is currently seeded
 * against it — the catalog's one TV listing ("TCL 55" QLED TV") doesn't name
 * a specific model number, and guessing one would misrepresent a real,
 * differently-specced product. See seed/README (or the seed/ directory
 * listing) for which categories currently have curated data.
 *
 * `performance` and `battery` are structurally never scored here (no
 * attribute maps to them) — a TV's processor isn't a shopper-facing spec the
 * way a phone's chip is, and a mains-powered TV has no battery. Same
 * precedent as `smartphone.ts` leaving `value` unscored: the component still
 * appears in `componentWeights`, it just never contributes to the composite.
 */
export const televisionSchema: CategorySchema = {
  id: "television",
  label: "Television",
  shopifyProductTypes: ["Televisions"],
  groups: [
    { id: "display", label: "Display" },
    { id: "performance", label: "Performance" },
    { id: "connectivity", label: "Smart Features & Connectivity" },
    { id: "build", label: "Build & Design" },
    { id: "software", label: "Software" },
  ],
  componentWeights: {
    display: 0.34,
    features: 0.22,
    build: 0.16,
    performance: 0.14,
    software: 0.08,
    camera: 0.02,
    battery: 0.02,
    value: 0.02,
  },
  attributes: [
    // --- Display ---------------------------------------------------------
    {
      key: "display_size_in",
      label: "Screen size",
      hint: "Diagonal screen size. Bigger fills more of the room from typical viewing distances.",
      valueType: "number",
      unit: "in",
      normalizer: "quantity",
      group: "display",
    },
    {
      key: "display_tech",
      label: "Panel type",
      hint: "OLED has per-pixel dimming for the deepest blacks; Mini-LED gets close with many local-dimming zones; QLED and LED trade some contrast for higher peak brightness.",
      valueType: "enum",
      normalizer: "enum",
      enumValues: ["LED", "QLED", "Mini-LED", "OLED"],
      enumRank: ["OLED", "Mini-LED", "QLED", "LED"],
      group: "display",
      scoring: { component: "display", weight: 3, higherIsBetter: true },
    },
    {
      key: "display_resolution",
      label: "Resolution",
      valueType: "text",
      normalizer: "resolution",
      group: "display",
    },
    {
      key: "refresh_rate_hz",
      label: "Refresh rate",
      hint: "How many times a second the screen redraws. 120Hz+ makes fast sports and gaming look smoother and reduces motion blur.",
      valueType: "integer",
      unit: "hz",
      normalizer: "quantity",
      group: "display",
      scoring: { component: "display", weight: 2, higherIsBetter: true },
    },
    {
      key: "hdr_support",
      label: "HDR format",
      hint: "High dynamic range shows brighter highlights and darker shadows in the same scene. Dolby Vision and HDR10+ adjust scene-by-scene; HDR10 is a fixed baseline.",
      valueType: "enum",
      normalizer: "enum",
      enumValues: ["None", "HDR10", "HDR10+", "Dolby Vision"],
      enumRank: ["Dolby Vision", "HDR10+", "HDR10", "None"],
      group: "display",
      scoring: { component: "display", weight: 2, higherIsBetter: true },
    },
    {
      key: "tv_peak_brightness_nits",
      label: "Peak brightness",
      hint: "How bright the screen can get. Higher makes HDR highlights pop more and helps in a bright room.",
      valueType: "integer",
      unit: "nits",
      normalizer: "quantity",
      group: "display",
      scoring: { component: "display", weight: 1.5, higherIsBetter: true },
    },
    // --- Performance ------------------------------------------------------
    {
      key: "processor",
      label: "Picture processor",
      hint: "The chip behind upscaling and motion processing. Manufacturers don't publish a comparable benchmark for this across brands.",
      valueType: "text",
      normalizer: "passthrough",
      group: "performance",
    },
    // --- Smart features & connectivity --------------------------------------
    {
      key: "smart_tv_os",
      label: "Smart TV platform",
      hint: "Which app ecosystem and interface it runs. Not ranked here — it's a matter of preference, not a quality gradient.",
      valueType: "enum",
      normalizer: "enum",
      enumValues: ["Google TV", "Android TV", "Tizen", "webOS", "Fire TV", "Roku TV", "Other"],
      group: "connectivity",
    },
    {
      key: "tv_hdmi_ports",
      label: "HDMI ports",
      valueType: "integer",
      unit: "count",
      normalizer: "quantity",
      group: "connectivity",
      scoring: { component: "features", weight: 1.5, higherIsBetter: true },
    },
    {
      key: "tv_usb_ports",
      label: "USB ports",
      valueType: "integer",
      unit: "count",
      normalizer: "quantity",
      group: "connectivity",
      scoring: { component: "features", weight: 1, higherIsBetter: true },
    },
    {
      key: "wifi_gen",
      label: "Wi-Fi",
      valueType: "enum",
      normalizer: "enum",
      enumValues: ["Wi-Fi 4", "Wi-Fi 5", "Wi-Fi 6", "Wi-Fi 6E", "Wi-Fi 7"],
      enumRank: ["Wi-Fi 7", "Wi-Fi 6E", "Wi-Fi 6", "Wi-Fi 5", "Wi-Fi 4"],
      group: "connectivity",
      scoring: { component: "features", weight: 1, higherIsBetter: true },
    },
    {
      key: "bluetooth",
      label: "Bluetooth",
      valueType: "boolean",
      normalizer: "boolean",
      group: "connectivity",
      scoring: { component: "features", weight: 0.5, higherIsBetter: true },
    },
    {
      key: "voice_assistant",
      label: "Built-in voice assistant",
      hint: "A far-field microphone for hands-free voice control, without needing a separate smart speaker.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "connectivity",
      scoring: { component: "features", weight: 1, higherIsBetter: true },
    },
    // --- Build ----------------------------------------------------
    {
      key: "tv_weight_kg",
      label: "Weight",
      hint: "Lighter is easier to wall-mount or move; this tracks screen size as much as build quality.",
      valueType: "number",
      unit: "kg",
      normalizer: "quantity",
      group: "build",
      scoring: { component: "build", weight: 1, higherIsBetter: false },
    },
    {
      key: "vesa_mount",
      label: "VESA wall-mount compatible",
      valueType: "boolean",
      normalizer: "boolean",
      group: "build",
      scoring: { component: "build", weight: 1, higherIsBetter: true },
    },
    {
      key: "build_materials",
      label: "Stand & bezel materials",
      valueType: "text",
      normalizer: "passthrough",
      group: "build",
    },
    // --- Software ------------------------------------------------
    {
      key: "tv_os_update_years",
      label: "Smart platform update commitment",
      hint: "How many years of software updates the maker has promised for the smart TV platform itself.",
      valueType: "integer",
      unit: "years",
      normalizer: "quantity",
      group: "software",
      scoring: { component: "software", weight: 2, higherIsBetter: true },
    },
  ],
};
