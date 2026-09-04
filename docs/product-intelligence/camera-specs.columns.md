# Camera spec-sheet columns

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
| `camera_sensor_mp` | Sensor & Image Quality | number | mp | Megapixels aren't the whole story — sensor size (below) matters at least as much for real image quality. |
| `sensor_size` | Sensor & Image Quality | enum | — | A bigger sensor gathers more light per pixel — better low-light performance and background blur, regardless of megapixel count. One of: 1-inch / Micro Four Thirds / APS-C / Full-Frame. |
| `camera_iso_max` | Sensor & Image Quality | integer | iso | How far the sensor's sensitivity can be pushed in the dark. Higher ceilings help in low light, at some cost to image noise. |
| `camera_af_points` | Sensor & Image Quality | integer | count | More AF points generally means faster, more reliable focus tracking across the frame, including on moving subjects. |
| `video_max_resolution` | Sensor & Image Quality | enum | — |  One of: 1080p / 4K / 6K / 8K. |
| `camera_burst_fps` | Performance | number | fps | Frames per second in continuous shooting — how well it keeps up with fast action. |
| `processor` | Performance | text | — |  |
| `screen_size_in` | Screen & Viewfinder | number | in |  |
| `camera_screen_dots` | Screen & Viewfinder | integer | dots | Dot count of the rear LCD. Higher makes reviewing shots and menus look sharper. |
| `articulating_screen` | Screen & Viewfinder | boolean | — | Whether the screen flips or tilts out — useful for vlogging, low/high angles and selfies. |
| `camera_viewfinder_dots` | Screen & Viewfinder | integer | dots | Dot count of the electronic viewfinder, where fitted. Higher looks sharper and more like an optical finder. |
| `camera_shots_per_charge` | Battery | integer | shots | CIPA-rated shots per charge — a standardised (and typically conservative) estimate, useful mainly for comparing models. |
| `battery_type` | Battery | text | — |  |
| `wifi` | Connectivity | boolean | — | Built-in Wi-Fi for transferring photos to a phone or computer without a cable. |
| `bluetooth` | Connectivity | boolean | — | Low-power always-on link for remote control and quick pairing to the Wi-Fi transfer. |
| `ibis` | Connectivity | boolean | — | Stabilises any lens attached, including older ones without their own stabilisation. |
| `usb_standard` | Connectivity | enum | — |  One of: Micro-USB / USB-C / USB 2.0 / USB 3.0 / USB 3.2. |
| `camera_card_slots` | Connectivity | integer | count | Two slots let you shoot to both cards at once for an instant backup. |
| `camera_weight_g` | Build & Design | number | g | Body-only weight; add the lens for what you'll actually carry. |
| `lens_mount` | Build & Design | text | — | Which lenses fit. A bigger, more established mount ecosystem means more lens choice, new and used. |
| `weather_sealed` | Build & Design | boolean | — | Gasketing against dust and light moisture. Not the same as being waterproof. |
| `firmware_updatable` | Software | boolean | — | Whether the maker can add features or improve autofocus/video after purchase. |

## Provenance

| Column | Meaning |
|---|---|
| `source` | Where the figures came from, e.g. "GSMArena", "Samsung spec page". |
| `source_url` | Link to re-check the figures. |
| `collected_date` | YYYY-MM-DD the figures were read at the source. |
