"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-accent">Error</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-neutral-500">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
