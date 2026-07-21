import type { ProductSpec } from "@/lib/shopify/types";

const KEY_SPEC_ORDER = ["processor", "ram", "storage", "battery", "camera", "display", "connectivity"];

export function sortSpecs(specs: ProductSpec[] | undefined): ProductSpec[] {
  return [...(specs ?? [])].sort((a, b) => KEY_SPEC_ORDER.indexOf(a.key) - KEY_SPEC_ORDER.indexOf(b.key));
}
