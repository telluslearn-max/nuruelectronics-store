import type { ProductSpec } from "@/lib/shopify/types";

const SPEC_LABELS: Record<string, string> = {
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

/** Renders only the spec metafields a product actually has set — never fabricated. */
export function ProductSpecs({ specs }: { specs: ProductSpec[] }) {
  if (specs.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="text-title">Specifications</h2>
      <dl className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
        {specs.map((spec) => (
          <div key={spec.key} className="grid grid-cols-2 gap-4 py-3 text-sm">
            <dt className="text-neutral-500">{SPEC_LABELS[spec.key] ?? spec.key}</dt>
            <dd>{spec.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
