# Product Intelligence Layer

NURU's own structured knowledge of what a product *is* — normalized specifications,
where each fact came from, and how much it can be trusted. Kept deliberately separate
from Shopify (the system of record for what's for sale and at what price) and from the
ERP ledger.

> Status: schema + normalization engine, ingestion, the nightly reconcile job,
> NURU Score, Fit Score, the comparison rebuild, the `/api/products/*` service
> layer and the WebMCP tools have all shipped. Schema coverage spans eight
> tech categories (below); six carry curated seed data today.

## Shape

| Piece | Where |
|---|---|
| Prisma models (`ProductProfile`, `IntelSource`, `SpecValue`) | `prisma/schema.prisma` |
| Category schemas (code, not data) | `src/lib/intelligence/schema/` |
| Normalization engine (pure) | `src/lib/intelligence/normalize.ts` |
| Confidence-from-source rules (pure) | `src/lib/intelligence/provenance.ts` |
| Shared types | `src/lib/intelligence/types.ts` |

## Principles

- **Data → deterministic engine → structured result → AI narration.** Never
  user → LLM → invented product facts.
- **Confidence is assigned from the source, never by a person.** There is no
  verification UI. NURU's own spec sheet is `verified`; a Shopify metafield is
  `high`; a Gemini grounded-search figure is `low` until something better
  replaces it. See `provenance.ts`.
- **Missing data is never invented.** A blank cell produces no `SpecValue`; a
  present-but-unparseable value produces one with `normalizedValue: null`. The
  comparison engine will show "not verified" and exclude the attribute from
  scoring rather than guess.
- **Categories are code.** Adding a category or re-tuning a weight is a reviewed
  change in `src/lib/intelligence/schema/`, not a database edit.

## Categories

| Category | Schema | Seed | Notes |
|---|---|---|---|
| Smartphone | `schema/smartphone.ts` | `seed/smartphones.ts` (Apple + Samsung) | |
| Laptop | `schema/laptop.ts` | `seed/laptops.ts` | |
| Tablet | `schema/tablet.ts` | `seed/tablets.ts` | |
| Audio (headphones) | `schema/audio.ts` | `seed/audio.ts` | |
| Camera | `schema/camera.ts` | `seed/cameras.ts` | |
| Gaming console | `schema/gaming-console.ts` | `seed/gaming-consoles.ts` | |
| Television | `schema/television.ts` | — | infra only; no catalog listing names a specific model yet |
| Power bank | `schema/power-bank.ts` | — | infra only; no catalog listing names a specific model yet |

Each seeded category has a matching `seed/apply-<category>.ts` (or, for
smartphones, `seed/apply.ts`) built on the shared `applyCuratedSeed` helper in
`seed/apply-shared.ts`, called from the nightly sync
(`ingest/sync.ts`/`syncProductIntelligence`).

## Filling a category's spec sheet

`<category>-specs.template.csv` in this folder has one column per that
category's schema attributes plus the identity columns (regenerate both the
CSV and its `.columns.md` guide with
`npx tsx scripts/intelligence/emit-spec-template.ts <category-id>` after
changing a schema). One row per **purchasable variant**, matched to Shopify by
`shopify_handle`.

- Leave a cell blank if you don't have a verified figure — do not guess.
- Values can be written naturally: `120 Hz`, `up to 120Hz`, `5000mAh`,
  `Super AMOLED`, `Snapdragon 8 Gen 3` all normalize correctly.
- The `source` / `source_url` / `collected_date` columns describe where the row's
  figures came from; the importer records them as one `IntelSource`.

Column meanings are in `<category>-specs.columns.md`, e.g.
`smartphone-specs.columns.md`, `laptop-specs.columns.md`.
