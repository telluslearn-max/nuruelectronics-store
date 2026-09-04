# Television spec-sheet columns

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
| `display_size_in` | Display | number | in | Diagonal screen size. Bigger fills more of the room from typical viewing distances. |
| `display_tech` | Display | enum | — | OLED has per-pixel dimming for the deepest blacks; Mini-LED gets close with many local-dimming zones; QLED and LED trade some contrast for higher peak brightness. One of: LED / QLED / Mini-LED / OLED. |
| `display_resolution` | Display | text | — |  |
| `refresh_rate_hz` | Display | integer | hz | How many times a second the screen redraws. 120Hz+ makes fast sports and gaming look smoother and reduces motion blur. |
| `hdr_support` | Display | enum | — | High dynamic range shows brighter highlights and darker shadows in the same scene. Dolby Vision and HDR10+ adjust scene-by-scene; HDR10 is a fixed baseline. One of: None / HDR10 / HDR10+ / Dolby Vision. |
| `tv_peak_brightness_nits` | Display | integer | nits | How bright the screen can get. Higher makes HDR highlights pop more and helps in a bright room. |
| `processor` | Performance | text | — | The chip behind upscaling and motion processing. Manufacturers don't publish a comparable benchmark for this across brands. |
| `smart_tv_os` | Smart Features & Connectivity | enum | — | Which app ecosystem and interface it runs. Not ranked here — it's a matter of preference, not a quality gradient. One of: Google TV / Android TV / Tizen / webOS / Fire TV / Roku TV / Other. |
| `tv_hdmi_ports` | Smart Features & Connectivity | integer | count |  |
| `tv_usb_ports` | Smart Features & Connectivity | integer | count |  |
| `wifi_gen` | Smart Features & Connectivity | enum | — |  One of: Wi-Fi 4 / Wi-Fi 5 / Wi-Fi 6 / Wi-Fi 6E / Wi-Fi 7. |
| `bluetooth` | Smart Features & Connectivity | boolean | — |  |
| `voice_assistant` | Smart Features & Connectivity | boolean | — | A far-field microphone for hands-free voice control, without needing a separate smart speaker. |
| `tv_weight_kg` | Build & Design | number | kg | Lighter is easier to wall-mount or move; this tracks screen size as much as build quality. |
| `vesa_mount` | Build & Design | boolean | — |  |
| `build_materials` | Build & Design | text | — |  |
| `tv_os_update_years` | Software | integer | years | How many years of software updates the maker has promised for the smart TV platform itself. |

## Provenance

| Column | Meaning |
|---|---|
| `source` | Where the figures came from, e.g. "GSMArena", "Samsung spec page". |
| `source_url` | Link to re-check the figures. |
| `collected_date` | YYYY-MM-DD the figures were read at the source. |
