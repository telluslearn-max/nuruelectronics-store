export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
      <div className="aspect-square animate-pulse rounded-card bg-neutral-100" />
      <div>
        <div className="h-7 w-2/3 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-5 w-24 animate-pulse rounded bg-neutral-100" />
        <div className="mt-8 h-4 w-full animate-pulse rounded bg-neutral-100" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-neutral-100" />
        <div className="mt-8 h-12 w-full animate-pulse rounded-control bg-neutral-100" />
      </div>
    </div>
  );
}
