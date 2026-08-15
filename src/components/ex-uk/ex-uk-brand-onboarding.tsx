"use client";

import type { ExUkBrand } from "./use-ex-uk-brand";

/**
 * First-run picker for the Ex-UK deck — same shape as a dating app's "who are you interested in"
 * step: pick a lane before swiping starts, instead of dropping shoppers into one mixed stack of
 * iPhones and Androids. The choice is persisted (use-ex-uk-brand.ts) so this only ever shows once
 * per browser; it's always changeable afterward via the switcher tabs on the Discover screen.
 */
export function ExUkBrandOnboarding({ onChoose }: { onChoose: (brand: ExUkBrand) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">What are you into?</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Pick a lane — you can switch anytime once you're in.</p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChoose("iphone")}
          className="flex flex-col items-center gap-1.5 rounded-card border border-border-subtle p-6 text-center transition hover:border-accent hover:bg-accent/5"
        >
          <span className="text-base font-semibold">iPhone</span>
          <span className="text-xs text-neutral-500">Ex-UK Apple units</span>
        </button>
        <button
          type="button"
          onClick={() => onChoose("android")}
          className="flex flex-col items-center gap-1.5 rounded-card border border-border-subtle p-6 text-center transition hover:border-accent hover:bg-accent/5"
        >
          <span className="text-base font-semibold">Android</span>
          <span className="text-xs text-neutral-500">Ex-UK Samsung units</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => onChoose("all")}
        className="text-sm font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
      >
        Or show me everything
      </button>
    </div>
  );
}
