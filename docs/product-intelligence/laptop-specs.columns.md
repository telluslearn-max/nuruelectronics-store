# Laptop spec-sheet columns

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
| `display_size_in` | Display | number | in | Screen size corner to corner. Bigger is easier for multitasking and video; smaller is lighter to carry. |
| `display_tech` | Display | enum | — | OLED and Mini-LED panels have deeper blacks and better contrast than a standard IPS LCD. One of: LCD / IPS LCD / Mini-LED / OLED. |
| `display_resolution` | Display | text | — | Total pixels. More pixels look sharper, most visibly on larger screens. |
| `laptop_display_ppi` | Display | integer | ppi | Pixels per inch. Laptops sit further from your eyes than phones, so this matters less than it does on a phone, but text still looks crisper above ~220 ppi. |
| `refresh_rate_hz` | Display | integer | hz | How many times a second the screen redraws. 90/120Hz makes scrolling and animation look smoother than 60Hz. |
| `laptop_peak_brightness_nits` | Display | integer | nits | How bright the screen can get. Higher means more readable outdoors or under office lighting. |
| `cpu` | Performance | text | — | The main chip. Faster chips handle video editing, compiling and heavy multitasking without slowing down. |
| `cpu_cores` | Performance | integer | cores |  |
| `gpu` | Performance | text | — | Integrated graphics handle everyday use and light creative work; a discrete GPU is built for gaming and heavy rendering. |
| `laptop_ram_gb` | Memory & Storage | integer | gb | Working memory. More RAM keeps more apps, browser tabs and background tasks running smoothly at once. |
| `laptop_storage_gb` | Memory & Storage | integer | gb | Space for the OS, apps and files. Most laptops can't have storage added later. |
| `storage_type` | Memory & Storage | enum | — | An SSD is dramatically faster to boot and load from than a spinning HDD. One of: HDD / eMMC / SSD. |
| `expandable_storage` | Memory & Storage | boolean | — | Whether you can open the case and add more RAM or swap the drive later. |
| `laptop_webcam_mp` | Webcam | integer | mp | Sharpness of the built-in camera for video calls. |
| `webcam_max_video` | Webcam | enum | — |  One of: 720p / 1080p / 4K. |
| `laptop_battery_wh` | Battery & Charging | number | wh | Bigger generally means longer between charges, though the screen and chip's efficiency matter too. |
| `battery_life_hours` | Battery & Charging | number | hours | The manufacturer's own estimate for typical use. Real-world life is usually somewhat lower. |
| `laptop_charging_w` | Battery & Charging | integer | w | Wattage of the charger it ships with. Higher means a faster top-up. |
| `wifi_gen` | Connectivity | enum | — |  One of: Wi-Fi 4 / Wi-Fi 5 / Wi-Fi 6 / Wi-Fi 6E / Wi-Fi 7. |
| `bluetooth_version` | Connectivity | enum | — |  One of: Bluetooth 4.2 / Bluetooth 5.0 / Bluetooth 5.1 / Bluetooth 5.2 / Bluetooth 5.3. |
| `thunderbolt_ports` | Connectivity | integer | count | High-speed ports for fast external drives, docks and multiple monitors. |
| `has_hdmi` | Connectivity | boolean | — |  |
| `has_sd_card_slot` | Connectivity | boolean | — |  |
| `laptop_weight_kg` | Build & Design | number | kg | Lighter is easier to carry daily; heavier often means a bigger battery or more ports. |
| `build_materials` | Build & Design | text | — | Aluminium and magnesium alloy feel more premium and resist flex better than plastic. |
| `keyboard_backlit` | Build & Design | boolean | — |  |
| `biometrics` | Build & Design | text | — |  |
| `os` | Software | text | — |  |
| `laptop_os_update_years` | Software | integer | years | How many years of major OS upgrades the maker has promised. Longer means the laptop stays current and secure for longer. |

## Provenance

| Column | Meaning |
|---|---|
| `source` | Where the figures came from, e.g. "GSMArena", "Samsung spec page". |
| `source_url` | Link to re-check the figures. |
| `collected_date` | YYYY-MM-DD the figures were read at the source. |
