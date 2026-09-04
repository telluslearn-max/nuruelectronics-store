import type { CategorySchema } from "@/lib/intelligence/types";

/**
 * The power bank category schema. Same role as `smartphone.ts`.
 *
 * Infrastructure-only for now: registered so the engine and comparison UI
 * cover the category, but no product is currently seeded against it — the
 * catalog's one power bank listing ("Anker Power Bank 20000mAh") doesn't name
 * a specific model number (Anker sells several 20000mAh models with
 * different output/port configurations), and guessing one would misrepresent
 * a real, differently-specced product.
 *
 * `performance`, `camera` and `software` are structurally never scored here
 * (no attribute maps to them) — same precedent as `smartphone.ts` leaving
 * `value` unscored: the component still appears in `componentWeights`, it
 * just never contributes to the composite.
 */
export const powerBankSchema: CategorySchema = {
  id: "power_bank",
  label: "Power Bank",
  shopifyProductTypes: ["Power Banks"],
  groups: [
    { id: "capacity", label: "Capacity & Charging" },
    { id: "connectivity", label: "Ports & Fast Charging" },
    { id: "build", label: "Build & Design" },
  ],
  componentWeights: {
    battery: 0.4,
    features: 0.24,
    build: 0.2,
    display: 0.06,
    performance: 0.04,
    camera: 0.02,
    software: 0.02,
    value: 0.02,
  },
  attributes: [
    // --- Capacity & charging ------------------------------------------
    {
      key: "powerbank_capacity_mah",
      label: "Capacity",
      hint: "Total stored charge. Real-world usable charge is always somewhat lower, lost to the bank's own conversion efficiency.",
      valueType: "integer",
      unit: "mah",
      normalizer: "quantity",
      group: "capacity",
      scoring: { component: "battery", weight: 4, higherIsBetter: true },
    },
    {
      key: "powerbank_energy_wh",
      label: "Energy",
      hint: "Capacity restated in watt-hours — the figure airlines actually cap for carry-on batteries (100Wh is the common limit).",
      valueType: "number",
      unit: "wh",
      normalizer: "quantity",
      group: "capacity",
      scoring: { component: "battery", weight: 1, higherIsBetter: true },
    },
    {
      key: "powerbank_output_w",
      label: "Max output power",
      hint: "How fast it can charge a connected device. Higher is needed to fast-charge a laptop, not just a phone.",
      valueType: "integer",
      unit: "w",
      normalizer: "quantity",
      group: "capacity",
      scoring: { component: "battery", weight: 3, higherIsBetter: true },
    },
    {
      key: "powerbank_input_w",
      label: "Max input power",
      hint: "How fast the power bank itself recharges.",
      valueType: "integer",
      unit: "w",
      normalizer: "quantity",
      group: "capacity",
      scoring: { component: "battery", weight: 1, higherIsBetter: true },
    },
    // --- Ports & fast charging ------------------------------------------
    {
      key: "powerbank_port_count",
      label: "Output ports",
      valueType: "integer",
      unit: "count",
      normalizer: "quantity",
      group: "connectivity",
      scoring: { component: "features", weight: 1.5, higherIsBetter: true },
    },
    {
      key: "usb_c_pd",
      label: "USB-C Power Delivery",
      hint: "The fast-charging standard most phones and laptops actually use over USB-C.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "connectivity",
      scoring: { component: "features", weight: 2, higherIsBetter: true },
    },
    {
      key: "qualcomm_qc",
      label: "Qualcomm Quick Charge",
      valueType: "boolean",
      normalizer: "boolean",
      group: "connectivity",
      scoring: { component: "features", weight: 1, higherIsBetter: true },
    },
    {
      key: "powerbank_wireless_w",
      label: "Wireless charging output",
      hint: "Qi wireless output, where fitted — set an entry to 0 for a wired-only power bank rather than leaving it blank.",
      valueType: "integer",
      unit: "w",
      normalizer: "quantity",
      group: "connectivity",
      scoring: { component: "features", weight: 1.5, higherIsBetter: true },
    },
    {
      key: "pass_through_charging",
      label: "Pass-through charging",
      hint: "Charge the power bank and a connected device from the same wall charger at once.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "connectivity",
      scoring: { component: "features", weight: 1, higherIsBetter: true },
    },
    {
      key: "has_display",
      label: "Charge-level display",
      hint: "An LED or LCD readout of the remaining charge, instead of a rough 4-LED indicator.",
      valueType: "boolean",
      normalizer: "boolean",
      group: "connectivity",
      scoring: { component: "display", weight: 1, higherIsBetter: true },
    },
    // --- Build ----------------------------------------------------
    {
      key: "powerbank_weight_g",
      label: "Weight",
      hint: "Higher capacity generally means heavier — weigh this against how much charge you actually need to carry.",
      valueType: "number",
      unit: "g",
      normalizer: "quantity",
      group: "build",
      scoring: { component: "build", weight: 2, higherIsBetter: false },
    },
    {
      key: "build_materials",
      label: "Casing material",
      valueType: "text",
      normalizer: "passthrough",
      group: "build",
    },
  ],
};
