export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-square animate-pulse rounded-card bg-neutral-100" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
      <div className="mt-16 h-64 animate-pulse rounded-card bg-neutral-100" />
    </div>
  );
}
