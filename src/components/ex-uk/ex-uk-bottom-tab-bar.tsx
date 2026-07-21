"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useExUkInbox } from "./use-ex-uk-inbox";
import { useExUkMatches } from "./use-ex-uk-matches";

function DiscoverIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
    </svg>
  );
}

function MessagesIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  );
}

export function ExUkBottomTabBar() {
  const pathname = usePathname();
  const { matches } = useExUkMatches();
  const { threads } = useExUkInbox();

  const unreadCount = matches.filter((m) => !threads[m.handle]?.messages.length).length;
  const onMessages = pathname.startsWith("/ex-uk/messages");

  return (
    <nav aria-label="Ex-UK" className="flex shrink-0 border-t border-border-subtle bg-background">
      <Link
        href="/ex-uk"
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
          !onMessages ? "text-accent" : "text-neutral-500"
        }`}
      >
        <DiscoverIcon className="h-6 w-6" filled={!onMessages} />
        Discover
      </Link>
      <Link
        href="/ex-uk/messages"
        className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
          onMessages ? "text-accent" : "text-neutral-500"
        }`}
      >
        <span className="relative">
          <MessagesIcon className="h-6 w-6" filled={onMessages} />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground">
              {unreadCount}
            </span>
          )}
        </span>
        Messages
      </Link>
    </nav>
  );
}
