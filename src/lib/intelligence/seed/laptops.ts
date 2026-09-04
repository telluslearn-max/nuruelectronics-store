/**
 * Curated, hand-verified laptop specs — the laptop-category counterpart to
 * `seed/smartphones.ts`. Same rules: written at `nuru_csv` (verified)
 * confidence, keyed by the laptop category-schema attribute keys, natural
 * strings the normalization engine reads. A blank / omitted key means "not
 * seeded," not "none."
 *
 * Current scope: this store's one identifiable laptop listing, the base
 * 14" MacBook Pro (M2 Pro, 2023) — `macbook-air-15` is deliberately not
 * seeded here, since the catalog doesn't say which Apple Silicon generation
 * (M2/M3/M4) that particular listing is, and guessing would misrepresent it.
 */

export type SeedSpecs = Record<string, string>;

/** model name -> specs. */
export const LAPTOP_MODEL_SPECS: Record<string, SeedSpecs> = {
  "MacBook Pro 14-inch (M2 Pro, 2023)": {
    display_size_in: "14.2 in",
    display_tech: "Mini-LED",
    display_resolution: "3024 x 1964",
    laptop_display_ppi: "254",
    refresh_rate_hz: "120 Hz",
    laptop_peak_brightness_nits: "1600 nits",
    cpu: "Apple M2 Pro",
    cpu_cores: "10",
    gpu: "Apple 16-core GPU",
    laptop_ram_gb: "16 GB",
    laptop_storage_gb: "512 GB",
    storage_type: "SSD",
    expandable_storage: "No",
    laptop_webcam_mp: "1 MP",
    webcam_max_video: "1080p",
    laptop_battery_wh: "70 Wh",
    battery_life_hours: "18 hours",
    laptop_charging_w: "67 W",
    wifi_gen: "Wi-Fi 6E",
    bluetooth_version: "Bluetooth 5.3",
    thunderbolt_ports: "3",
    has_hdmi: "Yes",
    has_sd_card_slot: "Yes",
    laptop_weight_kg: "1.6 kg",
    build_materials: "Aluminium unibody",
    keyboard_backlit: "Yes",
    biometrics: "Touch ID",
    os: "macOS",
    laptop_os_update_years: "7",
  },
};

/** Shopify handle -> the model it is (and identity fields). */
export const LAPTOP_SEED: Record<
  string,
  { shopifyProductId: string; model: string; releaseYear: number; brand: string; productFamily: string }
> = {
  "ex-uk-macbook-pro-14-m2": {
    shopifyProductId: "gid://shopify/Product/7812000000201",
    model: "MacBook Pro 14-inch (M2 Pro, 2023)",
    releaseYear: 2023,
    brand: "Apple",
    productFamily: "MacBook Pro",
  },
  // "macbook-air-15" is intentionally not seeded: the listing doesn't name a
  // chip generation (M2/M3/M4 all shipped as a 15" MacBook Air), and guessing
  // one would misrepresent a real, differently-specced product.
};
