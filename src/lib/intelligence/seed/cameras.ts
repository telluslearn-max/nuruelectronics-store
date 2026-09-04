/**
 * Curated, hand-verified camera specs — see `seed/smartphones.ts` for the
 * rules this follows.
 *
 * Current scope: this store's one identifiable camera listing, the Canon EOS
 * R50 (body). Web-verified against Canon's own specification pages
 * (collected 2026-09-04).
 */

export type SeedSpecs = Record<string, string>;

/** model name -> specs. */
export const CAMERA_MODEL_SPECS: Record<string, SeedSpecs> = {
  "Canon EOS R50": {
    camera_sensor_mp: "24.2 MP",
    sensor_size: "APS-C",
    camera_iso_max: "51200",
    camera_af_points: "651",
    video_max_resolution: "4K",
    camera_burst_fps: "12 fps",
    processor: "DIGIC X",
    screen_size_in: "3.0 in",
    camera_screen_dots: "1620000",
    articulating_screen: "Yes",
    camera_viewfinder_dots: "2360000",
    camera_shots_per_charge: "440 shots",
    battery_type: "LP-E17 rechargeable lithium-ion",
    wifi: "Yes",
    bluetooth: "Yes",
    ibis: "No",
    usb_standard: "USB-C",
    camera_card_slots: "1",
    camera_weight_g: "375 g",
    lens_mount: "Canon RF",
    weather_sealed: "No",
    firmware_updatable: "Yes",
  },
};

/** Shopify handle -> the model it is (and identity fields). */
export const CAMERA_SEED: Record<
  string,
  { shopifyProductId: string; model: string; releaseYear: number; brand: string; productFamily: string }
> = {
  "canon-eos-r50": {
    shopifyProductId: "gid://shopify/Product/7812000000501",
    model: "Canon EOS R50",
    releaseYear: 2023,
    brand: "Canon",
    productFamily: "EOS R",
  },
};
