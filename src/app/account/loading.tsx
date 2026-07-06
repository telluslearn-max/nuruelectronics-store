export default function Loading() {
  return (
    <div>
      <div className="h-8 w-40 animate-pulse rounded bg-neutral-100" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-neutral-100" />
      <div className="mt-10 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-card bg-neutral-100" />
        ))}
      </div>
    </div>
  );
}
