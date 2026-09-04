"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CompareTable } from "@/components/compare/compare-table";
import { ComponentRadar, PRODUCT_COLORS } from "@/components/compare/component-radar";
import type { ComparisonResultView } from "@/components/compare/comparison-result";
import type { ComparePayload, SpecRow } from "@/lib/intelligence/service/compare";
import { computeFitScore, type FitWeights } from "@/lib/intelligence/recommend/fit-score";
import { parseSearchIntent } from "@/lib/intelligence/service/intent";
import { SCORE_COMPONENTS, type ScoreComponent } from "@/lib/intelligence/types";

const COMPONENT_LABELS: Record<ScoreComponent, string> = {
  performance: "Performance",
  camera: "Camera",
  battery: "Battery",
  display: "Display",
  build: "Build",
  features: "Features",
  software: "Software",
  value: "Value",
};

/** "a, b and c" — the Oxford comma is deliberately omitted to read as speech. */
function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Renders whichever comparison shape the server produced. */
export function ComparisonView({
  view,
  onRemove,
}: {
  view: ComparisonResultView;
  onRemove: (handle: string) => void;
}) {
  if (view.kind === "empty") return null;
  if (view.kind === "basic") {
    return (
      <CompareTable
        columns={view.products}
        renderColumnHeader={(product) => (
          <div className="mt-2 space-y-3">
            <Link href={`/products/${product.handle}`} className="block text-sm font-semibold hover:text-accent">
              {product.title}
            </Link>
            <button
              type="button"
              onClick={() => onRemove(product.handle)}
              className="block text-xs font-medium text-neutral-500 hover:text-foreground"
            >
              Remove
            </button>
            <div className="w-36">
              <AddToCartButton variantId={product.variants[0]?.id} availableForSale={product.availableForSale} />
            </div>
          </div>
        )}
      />
    );
  }
  return <PremiumComparison payload={view.payload} onRemove={onRemove} />;
}

type Personalized = {
  weights: FitWeights;
  fit: { fitScore: number | null; coverage: number }[];
  bestIndex: number | null;
  orderedComponents: ScoreComponent[];
};

function PremiumComparison({
  payload,
  onRemove,
}: {
  payload: ComparePayload;
  onRemove: (handle: string) => void;
}) {
  const [priorities, setPriorities] = useState("");

  const personalized = useMemo<Personalized | null>(() => {
    const weights = parseSearchIntent(priorities).weights;
    if (Object.keys(weights).length === 0) return null;

    const componentsByProduct = payload.handles.map((_, i) => {
      const map: Partial<Record<ScoreComponent, number>> = {};
      for (const row of payload.components) map[row.component] = row.scores[i] ?? undefined;
      return map;
    });
    const fit = componentsByProduct.map((components) => {
      const result = computeFitScore(components, weights);
      return { fitScore: result.fitScore, coverage: result.coverage };
    });
    let bestIndex: number | null = null;
    fit.forEach((f, i) => {
      if (f.fitScore === null) return;
      if (bestIndex === null || (f.fitScore ?? -1) > (fit[bestIndex].fitScore ?? -1)) bestIndex = i;
    });
    const orderedComponents = [...SCORE_COMPONENTS]
      .filter((c) => payload.components.some((row) => row.component === c))
      .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
    return { weights, fit, bestIndex, orderedComponents };
  }, [priorities, payload]);

  const componentRows = personalized
    ? personalized.orderedComponents
        .map((c) => payload.components.find((row) => row.component === c)!)
        .filter(Boolean)
    : payload.components;

  return (
    <div className="mt-8 space-y-10">
      {/* Product header cards */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${payload.handles.length}, minmax(0, 1fr))` }}
      >
        {payload.handles.map((handle, i) => {
          const isBestFit = personalized?.bestIndex === i;
          return (
            <div
              key={handle}
              className={`relative rounded-card border p-4 ${
                isBestFit ? "border-accent ring-1 ring-accent" : "border-border-subtle"
              }`}
            >
              {isBestFit && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                  Best fit for you
                </span>
              )}
              <div className="relative mx-auto aspect-square w-24 overflow-hidden rounded-lg bg-neutral-100">
                {payload.images[i] && (
                  <Image src={payload.images[i]!} alt="" fill sizes="96px" className="object-contain" />
                )}
              </div>
              <Link
                href={`/products/${handle}`}
                className="mt-3 flex items-start gap-1.5 text-sm font-semibold leading-snug hover:text-accent"
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }}
                  aria-hidden
                />
                {payload.titles[i]}
              </Link>
              <div className="mt-1 text-sm text-neutral-600">
                {payload.prices[i]
                  ? formatPrice(payload.prices[i]!.amount, payload.prices[i]!.currencyCode)
                  : "Price unavailable"}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    payload.availability[i] ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {payload.availability[i] ? "In stock" : "Sold out"}
                </span>
                {payload.composites[i] !== null && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                    NURU {payload.composites[i]}
                  </span>
                )}
              </div>
              {personalized && (
                <div className="mt-3 border-t border-border-subtle pt-3">
                  <div className="text-2xl font-semibold tabular-nums">
                    {personalized.fit[i].fitScore ?? "—"}
                    <span className="ml-1 text-xs font-normal text-neutral-400">fit</span>
                  </div>
                  {personalized.fit[i].fitScore !== null && personalized.fit[i].coverage < 1 && (
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      based on {Math.round(personalized.fit[i].coverage * 100)}% of your priorities
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(handle)}
                className="mt-3 block text-xs font-medium text-neutral-500 hover:text-foreground"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {/* Personalize */}
      <div className="rounded-card bg-neutral-50 p-4">
        <label htmlFor="compare-priorities" className="text-sm font-medium">
          Tune for your priorities
        </label>
        <input
          id="compare-priorities"
          type="text"
          value={priorities}
          onChange={(event) => setPriorities(event.target.value)}
          placeholder="e.g. camera and battery matter most, I don't game"
          className="mt-2 w-full rounded-control border border-border-subtle bg-background px-3 py-2 text-base"
        />
        <p className="mt-1.5 text-xs text-neutral-500">
          {personalized
            ? "Fit Score and the order below now reflect what you told us."
            : "Type what matters and every product gets a personalised Fit Score."}
        </p>
      </div>

      {/* The ruling — one sentence: which to get, and the one reason not to */}
      <RulingLine payload={payload} personalized={personalized} />

      {/* At a glance */}
      {payload.summary.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">At a glance</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {payload.summary.map((line) => (
              <li key={line.component}>
                <span className="font-medium">
                  {payload.titles[payload.handles.indexOf(line.leaderHandle)]}
                </span>{" "}
                leads <span className="font-medium">{COMPONENT_LABELS[line.component]}</span>{" "}
                <span className="text-neutral-400">(+{line.margin})</span>
              </li>
            ))}
            {payload.compositeWinners.length === 1 && (
              <li className="pt-1 text-neutral-600">
                Highest overall NURU Score:{" "}
                <span className="font-medium text-foreground">
                  {payload.titles[payload.compositeWinners[0]]}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* The fork — the specs each product wins outright, bucketed by product */}
      <TheFork payload={payload} />

      {/* Component scores */}
      {componentRows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Score breakdown</h2>
          {payload.components.length >= 3 && (
            <div className="mt-4">
              <ComponentRadar
                axes={payload.components.map((row) => row.component)}
                labels={payload.components.map((row) => COMPONENT_LABELS[row.component])}
                series={payload.handles.map((_, i) => ({
                  label: payload.titles[i],
                  scores: payload.components.map((row) => row.scores[i]),
                }))}
              />
            </div>
          )}
          <div className="mt-4 space-y-4">
            {componentRows.map((row) => (
              <div key={row.component}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{COMPONENT_LABELS[row.component]}</span>
                  {personalized && personalized.weights[row.component] ? (
                    <span className="text-[11px] text-accent">weighted</span>
                  ) : null}
                </div>
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${payload.handles.length}, minmax(0, 1fr))` }}
                >
                  {row.scores.map((score, i) => (
                    <div key={i} className="text-xs">
                      <div className="mb-1 flex items-center gap-1 tabular-nums">
                        <span className={row.winners.includes(i) ? "font-semibold text-accent" : "text-neutral-600"}>
                          {score ?? "—"}
                        </span>
                        {row.winners.includes(i) && <WinnerTick />}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={`h-full rounded-full ${row.winners.includes(i) ? "bg-accent" : "bg-neutral-300"}`}
                          style={{ width: `${score ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Spec groups */}
      {payload.groups.length > 0 && <SpecGroups payload={payload} />}

      {/* Buy CTAs */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${payload.handles.length}, minmax(0, 1fr))` }}
      >
        {payload.handles.map((handle, i) => (
          <div key={handle}>
            {payload.defaultVariantIds[i] ? (
              <AddToCartButton
                variantId={payload.defaultVariantIds[i] ?? undefined}
                availableForSale={payload.availability[i]}
              />
            ) : (
              <Link
                href={`/products/${handle}`}
                className="block rounded-control bg-foreground px-4 py-3 text-center text-sm font-medium text-background transition hover:opacity-90"
              >
                View
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The one-line verdict above the fold. A stated set of priorities overrides the
 * generic ruling with a Fit-Score-based one; with nothing stated it falls back
 * to the server's composite-score ruling, or a "too close to call" line when no
 * product leads outright.
 */
function RulingLine({
  payload,
  personalized,
}: {
  payload: ComparePayload;
  personalized: Personalized | null;
}) {
  if (personalized && personalized.bestIndex !== null) {
    const best = personalized.bestIndex;
    const bestFit = personalized.fit[best].fitScore;
    const rivals = personalized.fit
      .filter((_, i) => i !== best)
      .map((f) => f.fitScore)
      .filter((s): s is number => s !== null);
    const margin =
      bestFit !== null && rivals.length > 0 ? Math.round((bestFit - Math.max(...rivals)) * 10) / 10 : null;
    return (
      <p className="text-lg leading-snug">
        For your priorities, the{" "}
        <strong className="font-semibold">{payload.titles[best]}</strong> fits best
        {bestFit !== null && (
          <>
            {" "}
            — Fit Score {bestFit}
            {margin !== null && margin > 0 ? `, ${margin} ahead of the next` : ""}
          </>
        )}
        .
      </p>
    );
  }

  const ruling = payload.ruling;
  if (!ruling) {
    return (
      <p className="text-lg leading-snug text-neutral-600">
        Too close to call on overall NURU Score — the differences below decide it.
      </p>
    );
  }
  const leads = ruling.leads.map((c) => COMPONENT_LABELS[c]);
  const holdout = ruling.holdout;
  return (
    <p className="text-lg leading-snug">
      Get the <strong className="font-semibold">{payload.titles[ruling.pick]}</strong>
      {leads.length > 0 ? <> — it leads {joinAnd(leads)}</> : <> — it takes the overall NURU Score</>}
      {holdout && holdout.leads.length > 0 && (
        <>
          . Choose the{" "}
          <strong className="font-semibold">{payload.titles[holdout.index]}</strong> only if{" "}
          {joinAnd(holdout.leads.map((c) => COMPONENT_LABELS[c].toLowerCase()))}{" "}
          {holdout.leads.length === 1 ? "matters" : "matter"} most
        </>
      )}
      .
    </p>
  );
}

/** "If you care about…" — each product's widest spec wins, side by side. */
function TheFork({ payload }: { payload: ComparePayload }) {
  if (!payload.fork.some((column) => column.length > 0)) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">The fork</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Where each one pulls ahead. Pick the column that sounds like you.
      </p>
      <div
        className="mt-3 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${payload.handles.length}, minmax(0, 1fr))` }}
      >
        {payload.handles.map((handle, i) => (
          <div key={handle} className="rounded-card border border-border-subtle p-4">
            <div className="flex items-start gap-1.5">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }}
                aria-hidden
              />
              <span className="text-sm font-semibold leading-snug">{payload.titles[i]}</span>
            </div>
            <div className="mt-0.5 pl-3.5 text-[11px] uppercase tracking-wide text-neutral-400">
              if you care about…
            </div>
            {payload.fork[i].length === 0 ? (
              <p className="mt-3 text-xs text-neutral-400">
                No standout wins — it trades on balance, not one strength.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {payload.fork[i].map((entry) => (
                  <li key={entry.key} className="text-sm">
                    <div className="font-medium">{entry.label}</div>
                    <div className="tabular-nums text-neutral-600">
                      {entry.values[i] ?? "—"}
                      <span className="text-neutral-400">
                        {" vs "}
                        {entry.values
                          .filter((_, j) => j !== i)
                          .map((v) => v ?? "—")
                          .join(" / ")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** True when the row isn't identical across every product — i.e. worth showing in "differences only" mode. */
function rowHasDifference(row: SpecRow): boolean {
  if (row.winners.length > 0) return true;
  const values = row.cells.map((cell) => cell?.rawValue ?? null);
  if (values.some((value) => value === null)) return true;
  return new Set(values).size > 1;
}

function SpecGroups({ payload }: { payload: ComparePayload }) {
  const [active, setActive] = useState(payload.groups[0]?.id ?? "");
  const [diffOnly, setDiffOnly] = useState(false);

  const groups = diffOnly
    ? payload.groups
        .map((g) => ({ ...g, rows: g.rows.filter(rowHasDifference) }))
        .filter((g) => g.rows.length > 0)
    : payload.groups;

  if (groups.length === 0) {
    return (
      <section>
        <DiffToggle diffOnly={diffOnly} setDiffOnly={setDiffOnly} />
        <p className="mt-4 text-sm text-neutral-500">These share every verified spec.</p>
      </section>
    );
  }

  const group = groups.find((g) => g.id === active) ?? groups[0];

  return (
    <section>
      <DiffToggle diffOnly={diffOnly} setDiffOnly={setDiffOnly} />
      <div className="mt-3 flex flex-wrap gap-2 border-b border-border-subtle pb-2">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActive(g.id)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              g.id === group.id ? "bg-foreground text-background" : "text-neutral-500 hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <tbody>
          {group.rows.map((row) => (
            <tr key={row.key} className="border-t border-border-subtle first:border-t-0">
              <th scope="row" className="w-32 py-3 pr-3 text-left align-top font-medium text-neutral-500">
                {row.label}
              </th>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={`px-3 py-3 align-top ${
                    row.winners.includes(i) ? "font-semibold text-accent" : "text-neutral-700"
                  }`}
                >
                  {cell ? (
                    <span className="inline-flex items-center gap-1">
                      {cell.rawValue}
                      {row.winners.includes(i) && <WinnerTick />}
                    </span>
                  ) : (
                    <span className="text-neutral-300">Not verified</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DiffToggle({
  diffOnly,
  setDiffOnly,
}: {
  diffOnly: boolean;
  setDiffOnly: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-neutral-600">
      <input
        type="checkbox"
        checked={diffOnly}
        onChange={(event) => setDiffOnly(event.target.checked)}
        className="h-4 w-4 rounded border-border-subtle accent-accent"
      />
      Differences only
    </label>
  );
}

function WinnerTick() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" aria-label="best">
      <path d="M3 8.5l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
