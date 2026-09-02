/**
 * Emits the spec-sheet CSV template and its column guide for a category, from
 * that category's schema — so the sheet NURU fills can never drift from what the
 * ingestion pipeline expects.
 *
 *   npx tsx scripts/intelligence/emit-spec-template.ts smartphone
 *
 * Writes docs/product-intelligence/<id>-specs.template.csv and
 * docs/product-intelligence/<id>-specs.columns.md.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCategorySchema } from "../../src/lib/intelligence/schema";

const IDENTITY_COLUMNS: { key: string; note: string }[] = [
  { key: "shopify_handle", note: "Shopify product handle — the join key. Required." },
  { key: "brand", note: "e.g. Samsung, Apple, Xiaomi." },
  { key: "product_family", note: "e.g. Galaxy S, iPhone, Redmi Note." },
  { key: "model", note: "e.g. Galaxy S25 Ultra." },
  { key: "generation", note: "e.g. 25, 17. Optional." },
  { key: "release_year", note: "Four-digit year the model launched." },
  { key: "variant_storage_gb", note: "This row's storage tier, e.g. 256." },
  { key: "variant_ram_gb", note: "This row's RAM tier, e.g. 12." },
  { key: "variant_color", note: "This row's colour." },
];

const PROVENANCE_COLUMNS: { key: string; note: string }[] = [
  { key: "source", note: 'Where the figures came from, e.g. "GSMArena", "Samsung spec page".' },
  { key: "source_url", note: "Link to re-check the figures." },
  { key: "collected_date", note: "YYYY-MM-DD the figures were read at the source." },
];

function main() {
  const id = process.argv[2];
  if (!id) throw new Error("usage: emit-spec-template.ts <category-id>");
  const schema = getCategorySchema(id);
  if (!schema) throw new Error(`no schema for category "${id}"`);

  const specColumns = schema.attributes.map((a) => a.key);
  const header = [
    ...IDENTITY_COLUMNS.map((c) => c.key),
    ...specColumns,
    ...PROVENANCE_COLUMNS.map((c) => c.key),
  ];

  const outDir = join(process.cwd(), "docs", "product-intelligence");
  const csvPath = join(outDir, `${id}-specs.template.csv`);
  writeFileSync(csvPath, `${header.join(",")}\n`, "utf8");

  const groupLabel = new Map(schema.groups.map((g) => [g.id, g.label]));
  const lines: string[] = [
    `# ${schema.label} spec-sheet columns`,
    "",
    "Generated from the category schema by `scripts/intelligence/emit-spec-template.ts` — do not edit by hand.",
    "",
    "## Identity",
    "",
    "| Column | Meaning |",
    "|---|---|",
    ...IDENTITY_COLUMNS.map((c) => `| \`${c.key}\` | ${c.note} |`),
    "",
    "## Specifications",
    "",
    "| Column | Group | Type | Unit | Notes |",
    "|---|---|---|---|---|",
    ...schema.attributes.map((a) => {
      const notes = a.hint ?? "";
      const enumNote = a.enumValues ? ` One of: ${a.enumValues.join(" / ")}.` : "";
      return `| \`${a.key}\` | ${groupLabel.get(a.group) ?? a.group} | ${a.valueType} | ${a.unit ?? "—"} | ${notes}${enumNote} |`;
    }),
    "",
    "## Provenance",
    "",
    "| Column | Meaning |",
    "|---|---|",
    ...PROVENANCE_COLUMNS.map((c) => `| \`${c.key}\` | ${c.note} |`),
    "",
  ];
  const mdPath = join(outDir, `${id}-specs.columns.md`);
  writeFileSync(mdPath, lines.join("\n"), "utf8");

  console.log(`wrote ${csvPath}`);
  console.log(`wrote ${mdPath}`);
}

main();
