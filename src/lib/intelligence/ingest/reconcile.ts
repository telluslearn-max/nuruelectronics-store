import { normalizeSpec } from "@/lib/intelligence/normalize";
import type { CategorySchema } from "@/lib/intelligence/types";

/**
 * Self-consistency for the AI grounded pass.
 *
 * The research call runs more than once. A field is only kept if the runs
 * *agree* on it after normalization — "5000mAh" and "5,000 mAh" agree; "5000mAh"
 * and "4800mAh" do not. This is the same discipline Capital Circle's scoring
 * ensemble uses: a number a model produces once under output pressure and never
 * repeats is exactly the kind of number that turns out to be invented.
 *
 * Numbers are allowed a small relative tolerance (default 2%) so genuine
 * rounding between sources ("6.7 in" vs "6.74 in") doesn't get thrown out.
 * Text and enum values must match exactly after normalization.
 */

export type SpecRun = Record<string, string>;

export type ReconciledValue = {
  key: string;
  /** The raw string from the first run that carried this agreed value. */
  rawValue: string;
  normalizedValue: string | null;
  unit: string | null;
};

export type ReconcileResult = {
  agreed: ReconciledValue[];
  /** Keys present in more than one run but with conflicting values — dropped. */
  conflicted: string[];
  /** Keys present in only one run — dropped (not corroborated). */
  uncorroborated: string[];
};

function numbersAgree(a: string, b: string, tolerance: number): boolean {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a === b;
  if (na === nb) return true;
  const scale = Math.max(Math.abs(na), Math.abs(nb));
  return scale > 0 && Math.abs(na - nb) / scale <= tolerance;
}

/** Cross-checks two or more research runs and returns only the values they corroborated. */
export function reconcileRuns(
  schema: CategorySchema,
  runs: SpecRun[],
  options: { numberTolerance?: number } = {},
): ReconcileResult {
  const tolerance = options.numberTolerance ?? 0.02;
  const attrByKey = new Map(schema.attributes.map((a) => [a.key, a]));

  // key -> list of { rawValue, normalized } across all runs that had it
  const byKey = new Map<string, { rawValue: string; normalizedValue: string | null; unit: string | null }[]>();
  for (const run of runs) {
    for (const [key, rawValue] of Object.entries(run)) {
      const attr = attrByKey.get(key);
      if (!attr || rawValue == null || String(rawValue).trim() === "") continue;
      const normalized = normalizeSpec(attr, String(rawValue));
      // Skip both "no value here" and "present but unparseable" — an AI run that
      // returned text the normalizer can't read isn't corroboration for anything,
      // it's noise, and this pass exists specifically to keep noise out.
      if (normalized === null || normalized.normalizedValue === null) continue;
      const list = byKey.get(key) ?? [];
      list.push({ rawValue: String(rawValue).trim(), ...normalized });
      byKey.set(key, list);
    }
  }

  const agreed: ReconciledValue[] = [];
  const conflicted: string[] = [];
  const uncorroborated: string[] = [];

  for (const [key, values] of byKey) {
    if (values.length < 2) {
      uncorroborated.push(key);
      continue;
    }
    const attr = attrByKey.get(key);
    const isNumeric = attr?.valueType === "number" || attr?.valueType === "integer";
    const first = values[0];
    const allAgree = values.every((v) => {
      if (first.normalizedValue === null || v.normalizedValue === null) {
        return first.normalizedValue === v.normalizedValue;
      }
      return isNumeric
        ? numbersAgree(first.normalizedValue, v.normalizedValue, tolerance)
        : first.normalizedValue === v.normalizedValue;
    });
    if (allAgree) agreed.push({ key, ...first });
    else conflicted.push(key);
  }

  return { agreed, conflicted, uncorroborated };
}
