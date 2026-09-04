# Tablet spec-sheet columns

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
| `display_size_in` | Display | number | in | Screen size corner to corner. Bigger is better for reading, drawing and video; smaller is lighter to hold one-handed. |
| `display_tech` | Display | enum | — | OLED panels have deeper blacks and better contrast than LCD. One of: LCD / IPS LCD / Mini-LED / OLED. |
| `display_resolution` | Display | text | — | Total pixels. More pixels look sharper, most visibly for text and fine detail. |
| `tablet_display_ppi` | Display | integer | ppi | Pixels per inch. Above ~260 ppi individual pixels are essentially invisible at normal reading distance. |
| `refresh_rate_hz` | Display | integer | hz | How many times a second the screen redraws. 90/120Hz makes scrolling and drawing with a stylus feel smoother than 60Hz. |
| `tablet_peak_brightness_nits` | Display | integer | nits | How bright the screen can get. Higher means more readable outdoors. |
| `cpu` | Performance | text | — | The main chip. Faster chips handle demanding apps, multitasking and photo/video editing without slowing down. |
| `gpu` | Performance | text | — |  |
| `tablet_ram_gb` | Memory & Storage | integer | gb | Working memory. More RAM keeps more apps and browser tabs open in the background without reloading. |
| `tablet_storage_gb` | Memory & Storage | integer | gb | Space for apps, files and downloaded media. Can't be increased later unless the tablet takes a memory card. |
| `expandable_storage` | Memory & Storage | boolean | — | Whether you can add storage with a microSD card. |
| `tablet_main_cam_mp` | Camera | integer | mp | Resolution of the rear camera. Most tablets prioritise the front camera for video calls over the rear one for photos. |
| `tablet_front_cam_mp` | Camera | integer | mp | Resolution of the front camera used for video calls. |
| `video_max_resolution` | Camera | enum | — |  One of: 1080p / 4K / 8K. |
| `tablet_battery_wh` | Battery & Charging | number | wh | Bigger generally means longer between charges, though screen size and chip efficiency also matter. |
| `tablet_charging_w` | Battery & Charging | integer | w | Wattage of the charger it ships with. Higher means a faster top-up. |
| `cellular` | Connectivity | enum | — | Whether a cellular variant exists, so the tablet can get online without Wi-Fi. One of: None / 4G / 5G. |
| `wifi_gen` | Connectivity | enum | — |  One of: Wi-Fi 4 / Wi-Fi 5 / Wi-Fi 6 / Wi-Fi 6E / Wi-Fi 7. |
| `usb_standard` | Connectivity | enum | — |  One of: Micro-USB / USB-C / Lightning / USB 2.0 / USB 3.0 / USB 3.2. |
| `stylus_support` | Connectivity | boolean | — | Whether the tablet supports a pressure-sensitive pen for drawing and notes. |
| `tablet_weight_g` | Build & Design | number | g | Lighter is easier to hold for long reading or drawing sessions; heavier often means a bigger battery. |
| `build_materials` | Build & Design | text | — |  |
| `biometrics` | Build & Design | text | — |  |
| `os` | Software | text | — |  |
| `os_update_years` | Software | integer | years | How many years of major OS upgrades the maker has promised. Longer means the tablet stays current and secure for longer. |

## Provenance

| Column | Meaning |
|---|---|
| `source` | Where the figures came from, e.g. "GSMArena", "Samsung spec page". |
| `source_url` | Link to re-check the figures. |
| `collected_date` | YYYY-MM-DD the figures were read at the source. |
