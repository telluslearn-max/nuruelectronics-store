import type { ProductSpec } from "@/lib/shopify/types";

export const SPEC_LABELS: Record<string, string> = {
  // Compute
  processor: "Processor",
  ram: "RAM",
  storage: "Storage",
  os: "Operating System",
  // Display / imaging
  display: "Display",
  resolution: "Resolution",
  camera: "Camera",
  sensor: "Sensor",
  // Audio
  driver_size: "Driver Size",
  polar_pattern: "Polar Pattern",
  frequency_response: "Frequency Response",
  // Power
  battery: "Battery",
  output_power: "Output Power",
  capacity: "Capacity",
  // Connectivity & fit
  connectivity: "Connectivity",
  compatibility: "Compatibility",
  water_resistance: "Water Resistance",
  // Physical
  dimensions: "Dimensions",
  weight: "Weight",
  material: "Material",
  // Appliances & general
  energy_rating: "Energy Rating",
  included_in_box: "In the Box",
};

// Groups the flat SPEC_LABELS keys above into the categorized sections the
// PDP renders. Flattening every group's `keys` in order must reproduce
// SPEC_LABELS' own key order exactly — keep the two in sync.
export type SpecCategory = { id: string; label: string; keys: string[] };
export const SPEC_CATEGORIES: SpecCategory[] = [
  { id: "compute", label: "Compute", keys: ["processor", "ram", "storage", "os"] },
  { id: "display", label: "Display & Imaging", keys: ["display", "resolution", "camera", "sensor"] },
  { id: "audio", label: "Audio", keys: ["driver_size", "polar_pattern", "frequency_response"] },
  { id: "power", label: "Power", keys: ["battery", "output_power", "capacity"] },
  {
    id: "connectivity",
    label: "Connectivity & Fit",
    keys: ["connectivity", "compatibility", "water_resistance"],
  },
  { id: "physical", label: "Physical", keys: ["dimensions", "weight", "material"] },
  { id: "general", label: "Appliances & General", keys: ["energy_rating", "included_in_box"] },
];

function CategoryIcon({ id, className }: { id: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    compute: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
        <path d="M9 3.5V7M12 3.5V7M15 3.5V7M9 17v3.5M12 17v3.5M15 17v3.5M3.5 9H7M3.5 12H7M3.5 15H7M17 9h3.5M17 12h3.5M17 15h3.5" />
      </>
    ),
    display: (
      <>
        <rect x="3" y="5" width="18" height="12" rx="1.5" />
        <path d="M8 21h8M12 17v4M7 9l4 4 3-3 3 3" />
      </>
    ),
    audio: (
      <>
        <path d="M5 10v4h3l5 4V6l-5 4H5Z" />
        <path d="M16.5 9a4.5 4.5 0 0 1 0 6" />
      </>
    ),
    power: (
      <>
        <rect x="7" y="3.5" width="10" height="17" rx="2" />
        <path d="M12 8v4l2.5 1.5" />
      </>
    ),
    connectivity: (
      <>
        <path d="M12 20.5v-3M6.5 15A8 8 0 0 1 12 12.7a8 8 0 0 1 5.5 2.3M3.5 11.5A12 12 0 0 1 12 8a12 12 0 0 1 8.5 3.5" />
        <circle cx="12" cy="20.5" r="0.75" fill="currentColor" stroke="none" />
      </>
    ),
    physical: (
      <>
        <rect x="3.5" y="7" width="17" height="10" rx="1.5" />
        <path d="M7 7v3M11 7v2M15 7v3M19 7v2" />
      </>
    ),
    general: (
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
        <path d="M4 10h16" />
        <circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    other: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[id]}
    </svg>
  );
}

/** Renders only spec metafields the product actually has set — never fabricated, grouped by category. */
export function ProductSpecs({ specs }: { specs: ProductSpec[] }) {
  if (specs.length === 0) return null;

  const specMap = new Map(specs.map((s) => [s.key, s.value]));
  const categorizedKeys = new Set(SPEC_CATEGORIES.flatMap((c) => c.keys));

  const groups = SPEC_CATEGORIES.map((category) => ({
    ...category,
    entries: category.keys
      .filter((key) => specMap.has(key))
      .map((key) => ({ key, value: specMap.get(key)! })),
  })).filter((group) => group.entries.length > 0);

  // Any spec key that isn't in one of the named categories above still gets
  // shown — grouping shouldn't mean silently dropping data the old flat
  // renderer would have displayed.
  const otherEntries = specs.filter((s) => !categorizedKeys.has(s.key));
  if (otherEntries.length > 0) {
    groups.push({ id: "other", label: "Other", keys: [], entries: otherEntries });
  }

  return (
    <section className="mt-16">
      <h2 className="text-title">Specifications</h2>
      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <CategoryIcon id={group.id} className="h-5 w-5 text-accent" />
              {group.label}
            </div>
            <dl className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
              {group.entries.map((spec) => (
                <div key={spec.key} className="grid grid-cols-2 gap-4 py-3 text-sm">
                  <dt className="text-neutral-500">{SPEC_LABELS[spec.key] ?? spec.key}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
