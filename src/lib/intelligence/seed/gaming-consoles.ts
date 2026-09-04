/**
 * Curated, hand-verified gaming console specs — see `seed/smartphones.ts` for
 * the rules this follows.
 *
 * Current scope: this store's one identifiable console listing, the Nintendo
 * Switch 2. Web-verified against Nintendo's own tech-specs page (collected
 * 2026-09-04). `soc`/`gpu_cuda_cores` are seeded but deliberately left
 * unscored in the schema (see schema/gaming-console.ts) — with one console in
 * the catalog there's no comparative basis for a performance index yet.
 */

export type SeedSpecs = Record<string, string>;

/** model name -> specs. */
export const GAMING_CONSOLE_MODEL_SPECS: Record<string, SeedSpecs> = {
  "Nintendo Switch 2": {
    soc: "Custom Nvidia (Ampere architecture)",
    gpu_cuda_cores: "1536",
    console_ram_gb: "12 GB",
    console_storage_gb: "256 GB",
    storage_type: "UFS",
    display_size_in: "7.9 in",
    display_tech: "LCD",
    display_resolution: "1920 x 1080",
    refresh_rate_hz: "120 Hz",
    max_output_resolution: "4K",
    console_battery_mah: "5220 mAh",
    console_battery_life_hours: "6.5 hours",
    console_charging_w: "39 W",
    wifi_gen: "Wi-Fi 6",
    bluetooth_version: "Bluetooth 5.2",
    nfc: "Yes",
    console_usb_ports: "2",
    game_card_slot: "Yes",
    headphone_jack: "Yes",
    console_weight_g: "420 g",
    form_factor: "Hybrid handheld/dockable",
    has_dock: "Yes",
    os: "Nintendo Switch 2 System Software",
    firmware_updatable: "Yes",
  },
};

/** Shopify handle -> the model it is (and identity fields). */
export const GAMING_CONSOLE_SEED: Record<
  string,
  { shopifyProductId: string; model: string; releaseYear: number; brand: string; productFamily: string }
> = {
  "nintendo-switch-2": {
    shopifyProductId: "gid://shopify/Product/7812000000601",
    model: "Nintendo Switch 2",
    releaseYear: 2025,
    brand: "Nintendo",
    productFamily: "Switch",
  },
};
