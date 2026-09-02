# Smartphone spec-sheet columns

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
| `display_size_in` | Display | number | in | Screen size corner to corner. Bigger is easier for video and reading; smaller is easier one-handed. |
| `display_tech` | Display | enum | — | OLED/AMOLED panels have deeper blacks and better contrast than LCD, and usually better outdoor visibility. One of: LCD / IPS LCD / OLED / AMOLED / LTPO OLED. |
| `display_resolution` | Display | text | — | Total pixels. More pixels look sharper, most visibly on larger screens. |
| `display_ppi` | Display | integer | ppi | Pixels per inch. Above ~400 ppi individual pixels are invisible at normal distance. |
| `refresh_rate_hz` | Display | integer | hz | How many times a second the screen redraws. 90/120Hz makes scrolling and animation look smoother than 60Hz. |
| `peak_brightness_nits` | Display | integer | nits | How bright the screen can get. Higher means more readable in direct sunlight. |
| `chipset` | Performance | text | — | The main chip. Faster chips handle demanding games and long recording sessions without slowing down. |
| `cpu_cores` | Performance | integer | cores |  |
| `gpu` | Performance | text | — |  |
| `ram_gb` | Memory & Storage | integer | gb | Working memory. More RAM keeps more apps open in the background without reloading. |
| `storage_gb` | Memory & Storage | integer | gb | Space for apps, photos and video. Can't be increased later unless the phone takes a memory card. |
| `expandable_storage` | Memory & Storage | boolean | — | Whether you can add storage with a microSD card. |
| `main_cam_mp` | Camera | integer | mp | Resolution of the primary rear camera. Sensor size and processing matter as much as the megapixel number. |
| `main_cam_ois` | Camera | boolean | — | Optical image stabilisation. Sharper low-light photos and steadier video. |
| `ultrawide_mp` | Camera | integer | mp | A second wider lens for landscapes and group shots. Absent on many budget phones. |
| `telephoto_mp` | Camera | integer | mp | A dedicated zoom lens. Keeps detail when zoomed in, unlike digital crop. |
| `telephoto_zoom_x` | Camera | number | x |  |
| `front_cam_mp` | Camera | integer | mp |  |
| `video_max_resolution` | Camera | enum | — | The highest-quality video the phone records. 4K is plenty for most; 8K needs a lot of storage. One of: 1080p / 4K / 8K. |
| `battery_mah` | Battery & Charging | integer | mah | Bigger generally means longer between charges, though screen size and chip efficiency also matter. |
| `charging_wired_w` | Battery & Charging | integer | w | Charging speed with a cable. Higher wattage fills the battery faster. |
| `charging_wireless_w` | Battery & Charging | integer | w |  |
| `reverse_charging` | Battery & Charging | boolean | — | Whether the phone can top up earbuds or another phone from its own battery. |
| `cellular` | Connectivity | enum | — |  One of: 3G / 4G / 5G. |
| `wifi_gen` | Connectivity | enum | — |  One of: Wi-Fi 4 / Wi-Fi 5 / Wi-Fi 6 / Wi-Fi 6E / Wi-Fi 7. |
| `nfc` | Connectivity | boolean | — | Needed for tap-to-pay and quick pairing. |
| `usb_standard` | Connectivity | enum | — |  One of: Micro-USB / USB-C / Lightning / USB 2.0 / USB 3.0 / USB 3.2. |
| `sim_config` | Connectivity | text | — |  |
| `ip_rating` | Build & Design | enum | — | IP rating for dust and water. IP68 tolerates brief submersion; no rating means keep it dry. One of: None / IP52 / IP53 / IP54 / IP67 / IP68 / IP69. |
| `weight_g` | Build & Design | number | g | Lighter is easier to hold for long periods; heavier often means a bigger battery or glass/metal build. |
| `build_materials` | Build & Design | text | — | Glass and metal feel more premium and can survive drops differently than plastic. |
| `biometrics` | Build & Design | text | — |  |
| `os` | Software | text | — |  |
| `android_version` | Software | number | — |  |
| `os_update_years` | Software | integer | years | How many years of major OS upgrades the maker has promised. Longer means the phone stays current and secure for longer. |
| `security_update_years` | Software | integer | years |  |

## Provenance

| Column | Meaning |
|---|---|
| `source` | Where the figures came from, e.g. "GSMArena", "Samsung spec page". |
| `source_url` | Link to re-check the figures. |
| `collected_date` | YYYY-MM-DD the figures were read at the source. |
