"use client";

import type { ExUkMatch } from "./use-ex-uk-matches";

export function MatchesTray({
  matches,
  onSelect,
}: {
  matches: ExUkMatch[];
  onSelect: (match: ExUkMatch) => void;
}) {
  if (matches.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-x-auto px-4 py-3">
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Your matches
        </span>
        {matches.map((match) => (
          <button
            key={match.handle}
            type="button"
            onClick={() => onSelect(match)}
            className="flex shrink-0 flex-col items-center gap-1 text-xs"
          >
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-neutral-100 text-neutral-400">
              {match.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={match.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                "♥"
              )}
            </span>
            <span className="max-w-[4.5rem] truncate text-neutral-600">{match.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
