# Product Intelligence Layer

NURU's own structured knowledge of what a product *is* — normalized specifications,
where each fact came from, and how much it can be trusted. Kept deliberately separate
from Shopify (the system of record for what's for sale and at what price) and from the
ERP ledger.

> Status: **PR 1 of the series** — schema + normalization engine only. Ingestion,
> the nightly reconcile job, NURU Score, Fit Score, the comparison rebuild, the
> `/api/products/*` service layer and the WebMCP tools land in later PRs.

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

## Filling the smartphone spec sheet

`smartphone-specs.template.csv` in this folder has one column per smartphone
schema attribute plus the identity columns. One row per **purchasable variant**,
matched to Shopify by `shopify_handle`.

- Leave a cell blank if you don't have a verified figure — do not guess.
- Values can be written naturally: `120 Hz`, `up to 120Hz`, `5000mAh`,
  `Super AMOLED`, `Snapdragon 8 Gen 3` all normalize correctly.
- The `source` / `source_url` / `collected_date` columns describe where the row's
  figures came from; the importer records them as one `IntelSource`.

Column meanings are in `smartphone-specs.columns.md`.
