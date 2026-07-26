/**
 * Suspense fallback for the Gaming category's product listing — GamingDarkTheme wraps this
 * synchronously (see category/[slug]/page.tsx), so unlike the generic `[slug]/loading.tsx` this
 * renders on top of the dark panel from the first paint and needs light-on-dark skeleton blocks,
 * not the site-wide light-mode `bg-neutral-100` ones.
 */
export function GamingCategorySkeleton() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-white/10" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-square animate-pulse rounded-card bg-white/10" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
