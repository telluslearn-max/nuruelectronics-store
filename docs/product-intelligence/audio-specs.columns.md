# Headphones spec-sheet columns

Generated from the category schema by `scripts/intelligence/emit-spec-template.ts` — do not edit by hand.

## Identity

| Column | Meaning |
|---|---|
| `shopify_handle` | Shopify product handle — the join key. Required. |
| `brand` | e.g. Samsung, Apple, Xiaomi. |
| `product_family` | e.g. Galaxy S, iPhone, Redmi Note. |
| `model` | e.g. Galaxy S25 Ultra. |
| `generation` | e.g. 25, 17. Optional. |
| `release_year` | Four-digit year the model launched. |
| `variant_storage_gb` | This row's storage tier, e.g. 256. |
| `variant_ram_gb` | This row's RAM tier, e.g. 12. |
| `variant_color` | This row's colour. |

## Specifications

| Column | Group | Type | Unit | Notes |
|---|---|---|---|---|
| `driver_size_mm` | Audio | number | mm | Larger drivers generally move more air, which tends to mean fuller bass — but tuning matters as much as size. |
| `freq_response_low_hz` | Audio | integer | hz |  |
| `freq_response_high_hz` | Audio | integer | hz |  |
| `hi_res_audio` | Audio | boolean | — | A wired or LDAC/aptX HD connection can carry more detail than standard Bluetooth. |
| `supports_ldac` | Audio | boolean | — | Sony's high-bitrate Bluetooth codec — noticeably better quality than standard SBC/AAC on a supporting phone. |
| `supports_aptx` | Audio | boolean | — | Qualcomm's high-quality Bluetooth codec family — mainly benefits Android phones that support it. |
| `anc` | Noise Cancelling & Controls | boolean | — | Electronically cancels ambient noise rather than just blocking it physically. The single biggest differentiator for commuting/travel use. |
| `transparency_mode` | Noise Cancelling & Controls | boolean | — | Pipes outside sound back in without taking the headphones off — useful for hearing announcements or having a conversation. |
| `audio_mic_count` | Noise Cancelling & Controls | integer | count | More microphones generally means better noise cancelling and clearer calls. |
| `multipoint` | Noise Cancelling & Controls | boolean | — | Stay connected to two devices at once, e.g. a laptop and a phone, and switch between them automatically. |
| `touch_controls` | Noise Cancelling & Controls | boolean | — |  |
| `wired_listening` | Noise Cancelling & Controls | boolean | — | Whether a 3.5mm cable can be used when the battery is dead. |
| `companion_app` | Noise Cancelling & Controls | text | — |  |
| `audio_battery_life_hours` | Battery & Charging | number | hours | Manufacturer-rated playback time with noise cancelling on. Real-world life is usually somewhat lower. |
| `quick_charge` | Battery & Charging | text | — | Extra playback time from a few minutes on charge. |
| `charging_port` | Battery & Charging | enum | — |  One of: Micro-USB / USB-C. |
| `audio_weight_g` | Build & Design | number | g | Lighter is more comfortable for long listening sessions. |
| `foldable` | Build & Design | boolean | — |  |
| `ip_rating` | Build & Design | enum | — | An IP or IPX rating means the manufacturer tested and certified it; no rating doesn't necessarily mean it's fragile, just unrated. One of: None / IPX2 / IPX4 / IPX5. |
| `build_materials` | Build & Design | text | — |  |
| `firmware_updatable` | Software | boolean | — | Whether the maker can improve ANC tuning, add codecs or fix bugs after purchase via the companion app. |

## Provenance

| Column | Meaning |
|---|---|
| `source` | Where the figures came from, e.g. "GSMArena", "Samsung spec page". |
| `source_url` | Link to re-check the figures. |
| `collected_date` | YYYY-MM-DD the figures were read at the source. |
