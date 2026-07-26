export default function Loading() {
  return (
    <div>
      <div className="max-w-2xl">
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
        <div className="mt-3 h-8 w-3/4 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-neutral-100" />
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 animate-pulse rounded-full bg-neutral-100" />
            <div className="h-3 w-12 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>

      <div className="mt-16 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-square animate-pulse rounded-card bg-neutral-100" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
