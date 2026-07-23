import { resolveSwatchColor } from "@/lib/color-swatches";

/**
 * Small color-swatch circles for a product's Color option values. The
 * neutral base circle always renders first, so an unrecognized value that
 * also isn't a valid CSS color just leaves the neutral base showing —
 * never a fabricated/wrong color.
 */
export function ColorSwatches({ values }: { values: string[] }) {
  const shown = values.slice(0, 5);
  const overflow = values.length - shown.length;

  return (
    <div className="mt-2 flex items-center gap-1.5">
      {shown.map((value) => (
        <span
          key={value}
          title={value}
          className="relative block h-5 w-5 shrink-0 rounded-full border border-border-subtle bg-neutral-200"
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: resolveSwatchColor(value) }}
          />
        </span>
      ))}
      {overflow > 0 && <span className="text-xs text-neutral-400">+{overflow}</span>}
    </div>
  );
}
