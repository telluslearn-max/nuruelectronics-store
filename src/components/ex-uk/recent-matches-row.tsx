import Link from "next/link";
import { HeartIcon } from "./action-icons";
import type { ExUkMatch } from "./use-ex-uk-matches";

export function RecentMatchesRow({ matches }: { matches: ExUkMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <div className="border-b border-border-subtle px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Recent matches</p>
      <div className="flex gap-3 overflow-x-auto">
        {matches.map((match) => (
          <Link
            key={match.handle}
            href={`/ex-uk/messages/${match.handle}`}
            className="flex shrink-0 flex-col items-center gap-1 text-xs"
          >
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-neutral-100 text-neutral-400">
              {match.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={match.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <HeartIcon className="h-6 w-6" />
              )}
            </span>
            <span className="max-w-[4.5rem] truncate text-neutral-600">{match.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
