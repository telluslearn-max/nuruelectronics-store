import { parseOriginOption } from "@/lib/origin-options";
import { SectionHeading } from "./section-heading";

type Column = ReturnType<typeof parseOriginOption>;

const ROWS: { label: string; has: (col: Column) => boolean; render: (col: Column) => string }[] = [
  {
    label: "SIM configuration",
    has: (col) => col.simConfig !== undefined,
    render: (col) => col.simConfig ?? "—",
  },
  {
    label: "FaceTime",
    has: (col) => col.facetime !== undefined,
    render: (col) => col.facetime ?? "—",
  },
  {
    label: "Warranty length",
    has: (col) => col.years !== undefined,
    render: (col) => (col.years ? `${col.years} year${col.years > 1 ? "s" : ""}` : "—"),
  },
  {
    label: "Serviced by",
    has: () => true,
    render: (col) =>
      col.serviceRegion === "East Africa"
        ? "Local East Africa service center"
        : "Imported stock (commonly Dubai, but not exclusively) — not tied to the local service center",
  },
  {
    label: "Condition",
    has: (col) => col.condition !== undefined,
    render: (col) => col.condition ?? "—",
  },
];

export function OriginGuide({ optionName, values }: { optionName: string; values: string[] }) {
  const columns = values.map((value) => parseOriginOption(value, optionName));
  const rows = ROWS.filter((row) => columns.some(row.has));
  const hasFacetimeInfo = columns.some((col) => col.facetime !== undefined);

  return (
    <section className="mt-16">
      <SectionHeading eyebrow="Buyer's Guide" title="Which stock option should you pick?" />
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-border-subtle py-3 pr-4" />
              {columns.map((col) => (
                <th
                  key={col.value}
                  className="border-b border-border-subtle px-4 py-3 text-left font-semibold"
                >
                  {col.value}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-3 pr-4 text-neutral-500">{row.label}</td>
                {columns.map((col) => (
                  <td key={col.value} className="px-4 py-3">
                    {row.render(col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-neutral-500">
        East Africa-sourced units are backed by a local service center for repairs. Imported units
        are brand new and sealed, but are sourced from multiple markets (commonly Dubai, but not
        exclusively), and can vary shipment to shipment{hasFacetimeInfo ? " — SIM configuration and FaceTime support can differ by unit and, where restricted, can't be changed by region settings" : ""}. Message us on
        WhatsApp before ordering an imported unit if this matters to you.
      </p>
      {hasFacetimeInfo && columns.some((col) => col.serviceRegion === "Imported") && (
        <p className="mt-3 text-xs text-neutral-500">
          The most common cause: iPhones built for mainland China ship with two physical SIM
          slots (no eSIM) and FaceTime Audio permanently disabled — a firmware-level restriction
          tied to that unit&apos;s region, not something region settings can undo. You can check
          this yourself on a specific unit under Settings → General → About → Model Number — a
          China-market unit&apos;s number ends in &quot;CH/A&quot;.
        </p>
      )}
    </section>
  );
}
