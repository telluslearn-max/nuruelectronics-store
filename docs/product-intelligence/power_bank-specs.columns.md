# Power Bank spec-sheet columns

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
| `powerbank_capacity_mah` | Capacity & Charging | integer | mah | Total stored charge. Real-world usable charge is always somewhat lower, lost to the bank's own conversion efficiency. |
| `powerbank_energy_wh` | Capacity & Charging | number | wh | Capacity restated in watt-hours — the figure airlines actually cap for carry-on batteries (100Wh is the common limit). |
| `powerbank_output_w` | Capacity & Charging | integer | w | How fast it can charge a connected device. Higher is needed to fast-charge a laptop, not just a phone. |
| `powerbank_input_w` | Capacity & Charging | integer | w | How fast the power bank itself recharges. |
| `powerbank_port_count` | Ports & Fast Charging | integer | count |  |
| `usb_c_pd` | Ports & Fast Charging | boolean | — | The fast-charging standard most phones and laptops actually use over USB-C. |
| `qualcomm_qc` | Ports & Fast Charging | boolean | — |  |
| `powerbank_wireless_w` | Ports & Fast Charging | integer | w | Qi wireless output, where fitted — set an entry to 0 for a wired-only power bank rather than leaving it blank. |
| `pass_through_charging` | Ports & Fast Charging | boolean | — | Charge the power bank and a connected device from the same wall charger at once. |
| `has_display` | Ports & Fast Charging | boolean | — | An LED or LCD readout of the remaining charge, instead of a rough 4-LED indicator. |
| `powerbank_weight_g` | Build & Design | number | g | Higher capacity generally means heavier — weigh this against how much charge you actually need to carry. |
| `build_materials` | Build & Design | text | — |  |

## Provenance

| Column | Meaning |
|---|---|
| `source` | Where the figures came from, e.g. "GSMArena", "Samsung spec page". |
| `source_url` | Link to re-check the figures. |
| `collected_date` | YYYY-MM-DD the figures were read at the source. |
