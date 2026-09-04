/**
 * Curated, hand-verified tablet specs — see `seed/smartphones.ts` for the
 * rules this follows (written at `nuru_csv`/verified confidence, natural
 * strings the normalization engine reads, blank means "not seeded").
 *
 * Current scope: this store's one identifiable tablet listing, the iPad Air
 * (5th generation, 2022, M1, Wi-Fi). Web-verified against Apple's own
 * tech-specs page (collected 2026-09-04).
 */

export type SeedSpecs = Record<string, string>;

/** model name -> specs. */
export const TABLET_MODEL_SPECS: Record<string, SeedSpecs> = {
  "iPad Air (5th generation)": {
    display_size_in: "10.9 in",
    display_tech: "IPS LCD",
    display_resolution: "2360 x 1640",
    tablet_display_ppi: "264",
    refresh_rate_hz: "60 Hz",
    tablet_peak_brightness_nits: "500 nits",
    cpu: "Apple M1",
    gpu: "Apple 8-core GPU",
    tablet_ram_gb: "8 GB",
    tablet_storage_gb: "64 GB",
    expandable_storage: "No",
    tablet_main_cam_mp: "12 MP",
    tablet_front_cam_mp: "12 MP",
    video_max_resolution: "4K",
    tablet_battery_wh: "28.6 Wh",
    tablet_charging_w: "20 W",
    cellular: "None",
    wifi_gen: "Wi-Fi 6",
    usb_standard: "USB-C",
    stylus_support: "Yes",
    tablet_weight_g: "461 g",
    build_materials: "Aluminium unibody",
    biometrics: "Touch ID",
    os: "iPadOS",
    os_update_years: "6",
  },
};

/** Shopify handle -> the model it is (and identity fields). */
export const TABLET_SEED: Record<
  string,
  { shopifyProductId: string; model: string; releaseYear: number; brand: string; productFamily: string }
> = {
  "ex-uk-ipad-air-5": {
    shopifyProductId: "gid://shopify/Product/7812000000301",
    model: "iPad Air (5th generation)",
    releaseYear: 2022,
    brand: "Apple",
    productFamily: "iPad Air",
  },
};
