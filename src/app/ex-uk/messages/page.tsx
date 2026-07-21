"use client";

import Link from "next/link";
import { ExUkTopBar } from "@/components/ex-uk/ex-uk-top-bar";
import { RecentMatchesRow } from "@/components/ex-uk/recent-matches-row";
import { useExUkInbox } from "@/components/ex-uk/use-ex-uk-inbox";
import { useExUkMatches } from "@/components/ex-uk/use-ex-uk-matches";
import { truncate } from "@/lib/format";

function timeAgo(ts: number): string {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function ExUkMessagesPage() {
  const { matches } = useExUkMatches();
  const { threads } = useExUkInbox();

  return (
    <>
      <ExUkTopBar title="Messages" />
      <div className="flex-1 overflow-y-auto">
        <RecentMatchesRow matches={matches} />

        {matches.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 pt-16 text-center">
            <p className="text-sm font-medium">No matches yet</p>
            <p className="text-sm text-neutral-500">Swipe right on an Ex-UK unit you love to start a conversation.</p>
          </div>
        ) : (
          <ul>
            {matches.map((match) => {
              const thread = threads[match.handle];
              const lastMessage = thread?.messages[thread.messages.length - 1];
              return (
                <li key={match.handle} className="border-b border-border-subtle">
                  <Link
                    href={`/ex-uk/messages/${match.handle}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-neutral-400">
                      {match.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={match.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        "♥"
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{match.title}</span>
                        <span className="shrink-0 text-xs text-neutral-400">
                          {timeAgo(thread?.updatedAt ?? match.likedAt)}
                        </span>
                      </span>
                      <span className="block truncate text-sm text-neutral-500">
                        {lastMessage ? truncate(lastMessage.text, 60) : "Say hi to start chatting"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
