// Universal disclosure shown identically on every Ex-UK listing — every unit goes through the
// same inspection process, so this isn't per-product data (unlike Specs/About this unit above
// it). Native <details>/<summary> is enough for an expand/collapse list; no JS state needed.
const INSPECTION_CATEGORIES: { label: string; detail: string }[] = [
  { label: "Screen & display", detail: "Checked for dead pixels, discoloration, and touch responsiveness." },
  { label: "Battery health", detail: "Measured and disclosed in the condition grade above." },
  { label: "Body & cosmetic condition", detail: "Inspected for dents, scratches, and cosmetic wear." },
  { label: "Ports & buttons", detail: "Every port and button tested for a firm, working connection." },
  { label: "Cameras", detail: "Front and rear cameras tested for focus and image quality." },
  { label: "WiFi & Bluetooth", detail: "Connectivity tested for a stable signal." },
  { label: "Mics & speakers", detail: "Audio input and output tested for clarity." },
  { label: "Cleanliness", detail: "Professionally cleaned before it ships to you." },
  { label: "Software & data wipe", detail: "Factory reset and signed out of all previous accounts." },
];

export function InspectionAccordion() {
  return (
    <div className="mt-5 border-t border-border-subtle pt-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        How we inspect every Ex-UK unit
      </h3>
      <div className="divide-y divide-border-subtle rounded-card border border-border-subtle">
        {INSPECTION_CATEGORIES.map((category) => (
          <details key={category.label} className="group px-3 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
              {category.label}
              <span className="text-neutral-400 transition group-open:rotate-180" aria-hidden="true">
                ▾
              </span>
            </summary>
            <p className="mt-1.5 text-sm text-neutral-600">{category.detail}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
