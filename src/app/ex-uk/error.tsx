"use client";

import Link from "next/link";

export default function ExUkError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm font-medium text-accent">Error</p>
      <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <div className="mt-4 flex gap-3">
        <button
          onClick={reset}
          className="rounded-control bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/ex-uk"
          className="rounded-control border border-border-subtle px-5 py-2.5 text-sm font-medium transition hover:border-foreground"
        >
          Back to Discover
        </Link>
      </div>
    </div>
  );
}
