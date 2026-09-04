# Gaming Console spec-sheet columns

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
| `soc` | Performance | text | — | The custom chip that runs the console. Faster chips hold higher resolution/framerate without dropping frames. |
| `gpu_cuda_cores` | Performance | integer | cores |  |
| `console_ram_gb` | Performance | integer | gb | Working memory shared between the system and the running game. |
| `console_storage_gb` | Performance | integer | gb | Built-in space for installed games. Most consoles support adding more via a memory card. |
| `storage_type` | Performance | enum | — |  One of: eMMC / UFS / SSD. |
| `display_size_in` | Display | number | in | Built-in handheld screen size. Bigger is easier to see; smaller is lighter and more pocketable. |
| `display_tech` | Display | enum | — | OLED panels have deeper blacks and better contrast than LCD. One of: LCD / OLED. |
| `display_resolution` | Display | text | — |  |
| `refresh_rate_hz` | Display | integer | hz | How many times a second the screen redraws. Higher makes fast-moving games look smoother. |
| `max_output_resolution` | Display | enum | — | The sharpest picture it can output to a TV when docked, separate from the handheld screen's own resolution. One of: 720p / 1080p / 4K. |
| `console_battery_mah` | Battery & Charging | integer | mah |  |
| `console_battery_life_hours` | Battery & Charging | number | hours | Manufacturer-rated handheld playtime. Varies a lot by game — demanding titles drain it faster. |
| `console_charging_w` | Battery & Charging | integer | w |  |
| `wifi_gen` | Connectivity | enum | — |  One of: Wi-Fi 4 / Wi-Fi 5 / Wi-Fi 6 / Wi-Fi 6E / Wi-Fi 7. |
| `bluetooth_version` | Connectivity | enum | — |  One of: Bluetooth 4.2 / Bluetooth 5.0 / Bluetooth 5.1 / Bluetooth 5.2 / Bluetooth 5.3. |
| `nfc` | Connectivity | boolean | — | Needed for tap-to-scan amiibo/accessory support. |
| `console_usb_ports` | Connectivity | integer | count |  |
| `game_card_slot` | Connectivity | boolean | — |  |
| `headphone_jack` | Connectivity | boolean | — |  |
| `console_weight_g` | Build & Design | number | g | Handheld weight (as held, e.g. with controllers attached). Lighter is more comfortable for long handheld sessions. |
| `form_factor` | Build & Design | text | — |  |
| `has_dock` | Build & Design | boolean | — | Whether a dock for TV play ships in the box, versus being sold separately. |
| `os` | Software | text | — |  |
| `firmware_updatable` | Software | boolean | — |  |

## Provenance

| Column | Meaning |
|---|---|
| `source` | Where the figures came from, e.g. "GSMArena", "Samsung spec page". |
| `source_url` | Link to re-check the figures. |
| `collected_date` | YYYY-MM-DD the figures were read at the source. |
