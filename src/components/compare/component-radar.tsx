"use client";

import { useId } from "react";
import type { ScoreComponent } from "@/lib/intelligence/types";

/**
 * A plain-SVG radar of the NURU Score components — one polygon per product, one
 * axis per component. Hand-rolled rather than pulled from a chart library: it's
 * a fixed 6-8 axis shape with no interaction, and the storefront bundle doesn't
 * otherwise carry a charting dependency. The "Score breakdown" bars below it
 * carry the same numbers for screen readers and the no-JS case, so this stays
 * decorative (`aria-hidden`).
 */

/** Categorical, colour-blind-safe enough for 2-4 overlaid shapes; index-aligned to the product order. */
export const PRODUCT_COLORS = ["#2563eb", "#d4472e", "#16a34a", "#9333ea"];

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 88;
const RINGS = [0.25, 0.5, 0.75, 1];

type Series = { label: string; scores: (number | null)[] };

function pointOnAxis(axisIndex: number, axisCount: number, fraction: number): [number, number] {
  const angle = -Math.PI / 2 + (axisIndex * 2 * Math.PI) / axisCount;
  return [CENTER + RADIUS * fraction * Math.cos(angle), CENTER + RADIUS * fraction * Math.sin(angle)];
}

function polygon(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

export function ComponentRadar({
  axes,
  labels,
  series,
}: {
  /** Component ids, in the order the axes are drawn. */
  axes: ScoreComponent[];
  /** Human labels for `axes`, same order. */
  labels: string[];
  /** One entry per product; `scores` index-aligned to `axes`. */
  series: Series[];
}) {
  const titleId = useId();
  if (axes.length < 3 || series.length === 0) return null;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-[280px] overflow-visible"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>Radar of NURU Score components for each product</title>

        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={polygon(axes.map((_, i) => pointOnAxis(i, axes.length, ring)))}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pointOnAxis(i, axes.length, 1);
          return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#e5e5e5" strokeWidth={1} />;
        })}

        {series.map((s, si) => {
          const color = PRODUCT_COLORS[si % PRODUCT_COLORS.length];
          return (
            <polygon
              key={s.label}
              points={polygon(axes.map((_, i) => pointOnAxis(i, axes.length, (s.scores[i] ?? 0) / 100)))}
              fill={color}
              fillOpacity={0.14}
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          );
        })}

        {labels.map((label, i) => {
          const [x, y] = pointOnAxis(i, axes.length, 1.16);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor={x > CENTER + 1 ? "start" : x < CENTER - 1 ? "end" : "middle"}
              dominantBaseline={y > CENTER + 1 ? "hanging" : y < CENTER - 1 ? "auto" : "middle"}
              className="fill-neutral-500 text-[9px] font-medium uppercase tracking-wide"
            >
              {label}
            </text>
          );
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {series.map((s, si) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PRODUCT_COLORS[si % PRODUCT_COLORS.length] }}
            />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
