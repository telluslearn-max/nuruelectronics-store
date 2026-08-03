import type { Product, ProductVariant } from "@/lib/shopify/types";

/**
 * Fixed BNPL rate card supplied directly by our Android-brand BNPL partner (deposit + monthly
 * installment per exact model/storage/RAM combo). Unlike the Apple-tier formula in bnpl.ts, these
 * figures are NOT derived — they're transcribed as given and must be used as a literal lookup.
 */
export type WuezeshaBrand = "samsung" | "google" | "oneplus" | "nothing";

export type WuezeshaRateRow = {
  id: string;
  brand: WuezeshaBrand;
  modelKey: string;
  storageGb: number;
  ramGb: number;
  depositKes: number;
  installment3moKes: number;
  installment6moKes: number;
  /** Original "Device Model" text from the rate card, kept for audit/support. */
  sourceLabel: string;
};

/** Strips a trailing "256+8" style storage+RAM suffix from a rate card's "Device Model" text. */
const RATE_LABEL_SUFFIX_RE = /\s*\d+\s*\+\s*\d+\s*$/;

export function normalizeModelKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function modelKeyFromRateLabel(label: string): string {
  return normalizeModelKey(label.replace(RATE_LABEL_SUFFIX_RE, ""));
}

function makeRow(
  brand: WuezeshaBrand,
  sourceLabel: string,
  storageGb: number,
  ramGb: number,
  depositKes: number,
  installment3moKes: number,
  installment6moKes: number,
): WuezeshaRateRow {
  const modelKey = modelKeyFromRateLabel(sourceLabel);
  return {
    id: `${brand}:${modelKey}:${storageGb}:${ramGb}`,
    brand,
    modelKey,
    storageGb,
    ramGb,
    depositKes,
    installment3moKes,
    installment6moKes,
    sourceLabel,
  };
}

/**
 * Transcribed from the partner's "Lipa pole pole rates" card. Rows are kept even when no matching
 * live product exists today (e.g. older/discontinued SKUs) — harmless, since matchWuezeshaRate simply
 * won't find a candidate product for them, and nothing needs re-adding if the SKU is restocked later.
 *
 * The OnePlus 15 512GB+16GB row is intentionally omitted: the source screenshot showed a malformed
 * value ("66,170/28,694/16,749@128000") that doesn't fit the Deposit/3mo/6mo pattern of every other
 * row. Add it once the correct figures are confirmed.
 */
export const WUEZESHA_RATE_CARD: WuezeshaRateRow[] = [
  makeRow("samsung", "A17 256+8", 256, 8, 15700, 6725, 3926),
  makeRow("samsung", "A26 128+6", 128, 6, 15958, 6837, 3991),
  makeRow("samsung", "A26 256+8", 256, 8, 17245, 7398, 4318),
  makeRow("samsung", "A36 256+8", 256, 8, 20078, 8631, 5038),
  makeRow("samsung", "A36 256+12", 256, 12, 21108, 9079, 5299),
  makeRow("samsung", "A37 256+8", 256, 8, 23425, 10088, 5888),
  makeRow("samsung", "A37 256+12", 256, 12, 24455, 10536, 6150),
  makeRow("samsung", "A56 256+8", 256, 8, 25228, 10872, 6346),
  makeRow("samsung", "A56 256+12", 256, 12, 27030, 11657, 6804),
  makeRow("samsung", "A57 256+8", 256, 8, 26258, 11321, 6608),
  makeRow("samsung", "A57 256+12", 256, 12, 28575, 12329, 7197),
  makeRow("samsung", "M56 256+8", 256, 8, 20335, 8743, 5103),
  makeRow("samsung", "S24 Ultra 512+12", 512, 12, 64883, 28133, 16422),
  makeRow("samsung", "S25 fe 256+8", 256, 8, 36043, 15580, 9094),
  makeRow("samsung", "S25 plus 256+12", 256, 12, 48660, 21072, 12300),
  makeRow("samsung", "S25 ultra 256+12", 256, 12, 58445, 25331, 14786),
  makeRow("samsung", "S26 256+12", 256, 12, 49175, 21296, 12431),
  makeRow("samsung", "S26 Ultra 256+12", 256, 12, 66428, 28806, 16814),
  makeRow("samsung", "Z flip 5 256+8", 256, 8, 33210, 14347, 8374),
  makeRow("samsung", "Z flip 7 256+12", 256, 12, 62050, 26900, 15702),
  makeRow("samsung", "Z fold 5 512+12", 512, 12, 75440, 32729, 19104),
  makeRow("samsung", "Z fold 6 256+12", 256, 12, 88830, 38557, 22506),
  makeRow("samsung", "Z fold 7 512+12", 512, 12, 95525, 41471, 24207),
  makeRow("google", "Pixel 9A 128+8", 128, 8, 28575, 12329, 7197),
  makeRow("google", "Pixel 9A 256+8", 256, 8, 30120, 13002, 7589),
  makeRow("google", "Pixel 10A 128+8", 128, 8, 31150, 13450, 7851),
  makeRow("google", "Pixel 10A 256+8", 256, 8, 32438, 14011, 8178),
  makeRow("google", "Pixel 10 128+12", 128, 12, 41965, 18158, 10599),
  makeRow("google", "Pixel 10 256+12", 256, 12, 45570, 19727, 11515),
  makeRow("google", "Pixel 10 pro 256+12", 256, 12, 65140, 28245, 16487),
  makeRow("google", "Pixel 10 pro XL 256+12", 256, 12, 64110, 27797, 16225),
  makeRow("oneplus", "Nord CE 5 256+8", 256, 8, 21880, 9415, 5496),
  makeRow("oneplus", "13 256+12", 256, 12, 49690, 21520, 12562),
  makeRow("oneplus", "13 512+16", 512, 16, 52265, 22641, 13216),
  makeRow("oneplus", "15 256+12", 256, 12, 57415, 24883, 14524),
  makeRow("nothing", "Phone 3A pro 256+12", 256, 12, 32953, 14235, 8309),
  makeRow("nothing", "Phone 3 256+12", 256, 12, 42223, 18270, 10664),
];

// Only strips the brand name itself — NOT the product line word ("Pixel"/"Phone"), since the
// rate card's own "Device Model" labels keep that word (e.g. "Pixel 10A", "Phone 3"). Samsung and
// OnePlus rate-card labels omit "Galaxy"/"OnePlus" entirely, so those prefixes strip further.
const BRAND_PREFIXES: Record<WuezeshaBrand, string[]> = {
  samsung: ["samsung galaxy", "samsung"],
  google: ["google"],
  oneplus: ["oneplus", "one plus"],
  nothing: ["nothing"],
};

function stripBrandPrefix(title: string, brand: WuezeshaBrand): string {
  const lower = title.toLowerCase();
  for (const prefix of BRAND_PREFIXES[brand]) {
    if (lower.startsWith(prefix)) return title.slice(prefix.length).trim();
  }
  return title;
}

const COMBINED_STORAGE_RAM_RE = /\d+\s*\/\s*\d+\s*gb\b/i;
const SINGLE_STORAGE_RE = /\d+\s*gb\b/i;

function stripModelSuffixes(s: string): string {
  return s
    .replace(/\b5g\b/gi, "")
    .replace(COMBINED_STORAGE_RAM_RE, "")
    .replace(SINGLE_STORAGE_RE, "")
    .trim();
}

function modelKeyFromProductTitle(title: string, brand: WuezeshaBrand): string {
  return normalizeModelKey(stripModelSuffixes(stripBrandPrefix(title, brand)));
}

function resolveBrand(product: Product): WuezeshaBrand | null {
  const vendor = product.vendor?.toLowerCase();
  const brands: WuezeshaBrand[] = ["samsung", "google", "oneplus", "nothing"];
  if (vendor && (brands as string[]).includes(vendor)) return vendor as WuezeshaBrand;
  return brands.find((b) => product.tags.includes(b)) ?? null;
}

type StorageRam = { storageGb: number; ramGb: number | null };

function extractStorageRam(text: string): StorageRam | null {
  const combined = text.match(/(\d+)\s*\/\s*(\d+)\s*gb/i);
  if (combined) {
    const a = Number(combined[1]);
    const b = Number(combined[2]);
    return { storageGb: Math.max(a, b), ramGb: Math.min(a, b) };
  }
  const single = text.match(/(\d+)\s*gb/i);
  if (single) return { storageGb: Number(single[1]), ramGb: null };
  return null;
}

function resolveStorageRam(product: Product, variant: ProductVariant | undefined): StorageRam | null {
  if (variant) {
    for (const option of variant.selectedOptions) {
      const found = extractStorageRam(option.value);
      if (found) return found;
    }
    const fromVariantTitle = extractStorageRam(variant.title);
    if (fromVariantTitle) return fromVariantTitle;
  }
  const fromProductTitle = extractStorageRam(product.title);
  if (fromProductTitle) return fromProductTitle;
  if (product.variants.length === 1 && product.specs) {
    const storage = product.specs.find((s) => s.key === "storage")?.value;
    const ram = product.specs.find((s) => s.key === "ram")?.value;
    if (storage) {
      const storageGb = Number(storage.match(/\d+/)?.[0]);
      const ramGb = ram ? Number(ram.match(/\d+/)?.[0]) : null;
      if (Number.isFinite(storageGb)) return { storageGb, ramGb: Number.isFinite(ramGb) ? ramGb : null };
    }
  }
  return null;
}

export type WuezeshaMatchResult =
  | { matched: true; row: WuezeshaRateRow }
  | { matched: false; reason: "brand-not-covered" | "model-not-found" | "storage-unresolved" | "ambiguous-ram" };

export function matchWuezeshaRate(product: Product, variant: ProductVariant | undefined): WuezeshaMatchResult {
  const brand = resolveBrand(product);
  if (!brand) return { matched: false, reason: "brand-not-covered" };

  const modelKey = modelKeyFromProductTitle(product.title, brand);
  const modelRows = WUEZESHA_RATE_CARD.filter((row) => row.brand === brand && row.modelKey === modelKey);
  if (modelRows.length === 0) return { matched: false, reason: "model-not-found" };

  const storageRam = resolveStorageRam(product, variant);
  if (!storageRam) return { matched: false, reason: "storage-unresolved" };

  const storageRows = modelRows.filter((row) => row.storageGb === storageRam.storageGb);
  if (storageRows.length === 0) return { matched: false, reason: "storage-unresolved" };

  if (storageRam.ramGb !== null) {
    const exact = storageRows.find((row) => row.ramGb === storageRam.ramGb);
    return exact ? { matched: true, row: exact } : { matched: false, reason: "storage-unresolved" };
  }

  if (storageRows.length === 1) return { matched: true, row: storageRows[0] };
  console.warn(
    `matchWuezeshaRate: ambiguous RAM for "${product.title}" (${storageRam.storageGb}GB, ${storageRows.length} candidate rate rows)`,
  );
  return { matched: false, reason: "ambiguous-ram" };
}
