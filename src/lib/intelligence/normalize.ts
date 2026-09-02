import type { NormalizedSpec, NormalizerId, SpecAttribute } from "@/lib/intelligence/types";

/**
 * The normalization engine.
 *
 * Different sources describe the same fact differently — "120Hz", "120 Hz",
 * "up to 120 Hz", "120Hz refresh rate" are one number. Everything downstream
 * (scoring, comparison, filtering, the "winner by category" call) needs the
 * number, not the prose. This module is the single place raw strings become
 * machine-readable, and it is pure: same input, same output, no I/O.
 *
 * `normalizeSpec` dispatches on the attribute's `normalizer` id. Each primitive
 * returns `{ normalizedValue, unit }`, with `normalizedValue: null` meaning
 * "there was a value here but it couldn't be understood" — deliberately
 * distinct from the attribute being absent, so ingestion can flag it.
 */

// --- shared helpers -------------------------------------------------------

/** Trim, collapse internal whitespace, strip a trailing period. */
function tidy(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").replace(/\.$/, "").trim();
}

/**
 * Pull the first number out of a string, tolerating thousands separators and a
 * leading "up to" / "approx" / "~". Returns null when there is no number.
 * "up to 120 Hz" → 120 ; "5,000mAh" → 5000 ; "≈6.7 in" → 6.7
 */
function firstNumber(raw: string): number | null {
  const cleaned = raw.replace(/[≈~]/g, " ").replace(/(\d),(\d{3})\b/g, "$1$2");
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/** Format a number back to a compact decimal string: 120 → "120", 6.70 → "6.7". */
function numberToString(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

// --- primitives ---------------------------------------------------------

/**
 * A quantity with a unit. The attribute names the canonical `unit`; the raw
 * string may spell it differently or omit it entirely ("120" for a refresh
 * rate). We take the number and stamp the canonical unit — we do not attempt
 * cross-unit conversion here beyond the storage primitive's GB/TB case.
 */
function normalizeQuantity(raw: string, unit: string | undefined): NormalizedSpec {
  const n = firstNumber(raw);
  if (n === null) return { normalizedValue: null, unit: unit ?? null };
  return { normalizedValue: numberToString(n), unit: unit ?? null };
}

/**
 * A storage / memory capacity, always resolved to whole gigabytes.
 * "256GB" → 256 ; "1 TB" → 1024 ; "512 MB" → 1 (rounded up, floored at 1).
 */
function normalizeStorage(raw: string): NormalizedSpec {
  const n = firstNumber(raw);
  if (n === null) return { normalizedValue: null, unit: "gb" };
  const lower = raw.toLowerCase();
  let gb: number;
  if (/\btb\b|terabyte/.test(lower)) gb = n * 1024;
  else if (/\bmb\b|megabyte/.test(lower)) gb = Math.max(1, Math.round(n / 1024));
  else gb = n; // bare number or GB
  return { normalizedValue: numberToString(Math.round(gb)), unit: "gb" };
}

const BOOLEAN_TRUE = new Set([
  "yes", "y", "true", "1", "✓", "✔", "有", "supported", "available", "included", "standard",
]);
const BOOLEAN_FALSE = new Set([
  "no", "n", "false", "0", "✗", "✘", "-", "—", "–", "none", "not supported", "unsupported", "n/a", "na",
]);

/**
 * A yes/no field. "Optional" resolves to null (present as a paid extra is
 * neither a clean yes nor a clean no, and scoring shouldn't reward it as a
 * standard feature). Unrecognised text → null.
 */
function normalizeBoolean(raw: string): NormalizedSpec {
  const token = tidy(raw).toLowerCase();
  if (token === "optional" || token === "optional extra") return { normalizedValue: null, unit: null };
  if (BOOLEAN_TRUE.has(token)) return { normalizedValue: "true", unit: null };
  if (BOOLEAN_FALSE.has(token)) return { normalizedValue: "false", unit: null };
  // "Yes, 45W" / "No wireless" — lead with the polarity word.
  if (/^yes\b/i.test(token)) return { normalizedValue: "true", unit: null };
  if (/^no\b/i.test(token)) return { normalizedValue: "false", unit: null };
  return { normalizedValue: null, unit: null };
}

/**
 * One token from a fixed set. Matching is case/space/punctuation-insensitive
 * and runs through the attribute's own `enumValues` plus a small shared synonym
 * table. Unmatched input keeps its tidied form as the normalized value (so a
 * new panel type isn't silently dropped) but callers can tell it apart because
 * it won't be in `enumValues`.
 */
function enumKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const ENUM_SYNONYMS: Record<string, string> = {
  // 5G / network
  "5g": "5G",
  "sub6": "5G",
  "5gsub6": "5G",
  "5gmmwave": "5G",
  "4g": "4G",
  "4glte": "4G",
  lte: "4G",
  // Wi-Fi generations
  wifi4: "Wi-Fi 4",
  wifi5: "Wi-Fi 5",
  wifi6: "Wi-Fi 6",
  "wifi6e": "Wi-Fi 6E",
  wifi7: "Wi-Fi 7",
  "80211ax": "Wi-Fi 6",
  "80211be": "Wi-Fi 7",
  // USB
  usbc: "USB-C",
  "usbtypec": "USB-C",
  "usb2": "USB 2.0",
  "usb20": "USB 2.0",
  "usb3": "USB 3.0",
  "usb32": "USB 3.2",
  lightning: "Lightning",
  // Common display panels
  oled: "OLED",
  amoled: "AMOLED",
  superamoled: "AMOLED",
  "dynamicamoled": "AMOLED",
  "dynamicamoled2x": "AMOLED",
  ltpo: "LTPO OLED",
  "ltpoamoled": "LTPO OLED",
  "ltpooled": "LTPO OLED",
  ips: "IPS LCD",
  "ipslcd": "IPS LCD",
  lcd: "LCD",
  tft: "LCD",
};

function normalizeEnum(raw: string, attr: SpecAttribute): NormalizedSpec {
  const tidied = tidy(raw);
  const key = enumKey(tidied);
  const allowed = attr.enumValues ?? [];

  for (const value of allowed) {
    if (enumKey(value) === key) return { normalizedValue: value, unit: null };
  }
  const synonym = ENUM_SYNONYMS[key];
  if (synonym && (allowed.length === 0 || allowed.includes(synonym))) {
    return { normalizedValue: synonym, unit: null };
  }
  // Whole-word match against an allowed token inside a longer phrase
  // ("5G (sub-6)" contains the word "5G"). Word-boundary anchored so "OLED"
  // does not match inside "MicroLED".
  for (const value of allowed) {
    const pattern = new RegExp(`(^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
    if (pattern.test(tidied)) return { normalizedValue: value, unit: null };
  }
  return { normalizedValue: tidied || null, unit: null };
}

/**
 * A system-on-chip name, collapsed to a canonical form so two spellings of one
 * chip compare equal and the scoring engine's chip→performance table has a
 * single key to look up. Vendor prefixes are dropped; series names are
 * expanded ("SD" → "Snapdragon"). Unknown chips keep their tidied name.
 */
function normalizeChipset(raw: string): NormalizedSpec {
  let s = tidy(raw)
    .replace(/^(qualcomm|mediatek|samsung|google|apple|unisoc)\s+/i, "")
    .replace(/\bSD\b/g, "Snapdragon")
    .replace(/\bSnapdragon\s+/i, "Snapdragon ")
    .replace(/\bDimensity\s+/i, "Dimensity ")
    .replace(/\s*\(.*?\)\s*/g, " ") // drop parenthetical fab notes
    .replace(/\s+/g, " ")
    .trim();
  // Title-case the leading brand word, keep the rest as written.
  s = s.replace(/^(snapdragon|dimensity|exynos|tensor|helio|bionic)\b/i, (m) =>
    m.charAt(0).toUpperCase() + m.slice(1).toLowerCase(),
  );
  return { normalizedValue: s || null, unit: null };
}

/** A pixel resolution: normalize the separator, drop the word "pixels". "2340 x 1080 pixels" → "2340x1080". */
function normalizeResolution(raw: string): NormalizedSpec {
  const match = tidy(raw)
    .toLowerCase()
    .replace(/pixels?/g, "")
    .match(/(\d{3,5})\s*[x×by]+\s*(\d{3,5})/);
  if (!match) return { normalizedValue: null, unit: null };
  return { normalizedValue: `${match[1]}x${match[2]}`, unit: null };
}

function normalizePassthrough(raw: string): NormalizedSpec {
  const tidied = tidy(raw);
  return { normalizedValue: tidied || null, unit: null };
}

// --- dispatch ----------------------------------------------------------

const EMPTY_MARKERS = new Set(["", "-", "—", "–", "n/a", "na", "tbd", "unknown", "?"]);

/**
 * Normalize one raw spec string for one attribute. Returns null when the raw
 * value is blank or an explicit "no data" marker; returns
 * `{ normalizedValue: null }` when there was content that couldn't be parsed.
 */
export function normalizeSpec(attr: SpecAttribute, rawValue: string): NormalizedSpec | null {
  if (EMPTY_MARKERS.has(rawValue.trim().toLowerCase())) return null;

  const run: Record<NormalizerId, () => NormalizedSpec> = {
    quantity: () => normalizeQuantity(rawValue, attr.unit),
    storage: () => normalizeStorage(rawValue),
    boolean: () => normalizeBoolean(rawValue),
    enum: () => normalizeEnum(rawValue, attr),
    chipset: () => normalizeChipset(rawValue),
    resolution: () => normalizeResolution(rawValue),
    passthrough: () => normalizePassthrough(rawValue),
  };
  return run[attr.normalizer]();
}

/**
 * Normalize a whole raw record (one product's row from a CSV, keyed by
 * attribute key) against a category schema. Keys not in the schema are ignored;
 * blank cells are skipped. Used by the ingestion pipeline.
 */
export function normalizeRecord(
  attributes: SpecAttribute[],
  raw: Record<string, string | null | undefined>,
): Map<string, { rawValue: string; normalized: NormalizedSpec }> {
  const out = new Map<string, { rawValue: string; normalized: NormalizedSpec }>();
  const byKey = new Map(attributes.map((a) => [a.key, a]));
  for (const [key, value] of Object.entries(raw)) {
    const attr = byKey.get(key);
    if (!attr || value == null || value.trim() === "") continue;
    const normalized = normalizeSpec(attr, value);
    if (normalized === null) continue;
    out.set(key, { rawValue: value.trim(), normalized });
  }
  return out;
}
