/**
 * Curated, hand-verified headphone specs — see `seed/smartphones.ts` for the
 * rules this follows.
 *
 * Current scope: this store's one identifiable audio listing, the Sony
 * WH-1000XM5. Web-verified against Sony's own specification page (collected
 * 2026-09-04). Sony does not publish an official IP/water-resistance rating
 * for this model, so `ip_rating` is left unseeded rather than guessed.
 */

export type SeedSpecs = Record<string, string>;

/** model name -> specs. */
export const AUDIO_MODEL_SPECS: Record<string, SeedSpecs> = {
  "Sony WH-1000XM5": {
    driver_size_mm: "30 mm",
    freq_response_low_hz: "20 Hz",
    freq_response_high_hz: "40000 Hz",
    hi_res_audio: "Yes",
    supports_ldac: "Yes",
    supports_aptx: "No",
    anc: "Yes",
    transparency_mode: "Yes",
    audio_mic_count: "8",
    multipoint: "Yes",
    touch_controls: "Yes",
    wired_listening: "Yes",
    companion_app: "Sony | Headphones Connect",
    audio_battery_life_hours: "30 hours",
    quick_charge: "3 min charge for up to 3 hours playback",
    charging_port: "USB-C",
    audio_weight_g: "250 g",
    foldable: "No",
    build_materials: "Plastic ear cups and headband, synthetic leather ear pads",
    firmware_updatable: "Yes",
  },
};

/** Shopify handle -> the model it is (and identity fields). */
export const AUDIO_SEED: Record<
  string,
  { shopifyProductId: string; model: string; releaseYear: number; brand: string; productFamily: string }
> = {
  "ex-uk-sony-wh1000xm5": {
    shopifyProductId: "gid://shopify/Product/7812000000401",
    model: "Sony WH-1000XM5",
    releaseYear: 2022,
    brand: "Sony",
    productFamily: "WH-1000X",
  },
};
