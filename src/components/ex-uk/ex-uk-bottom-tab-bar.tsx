"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WhatsAppIcon } from "@/components/whatsapp-order-button";
import { useExUkInbox } from "./use-ex-uk-inbox";
import { useExUkMatches } from "./use-ex-uk-matches";

function HomeIcon({ className, filled }: { className?: string; filled?: boolean }) {
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

/**
 * Floating capsule nav — Home (Discover) / Search / WhatsApp. The third slot is the entry point
 * to the per-product concierge chat inbox (ex-uk-conversation.tsx, backed by the same Concierge
 * chat components as the rest of the site) rather than an external wa.me link — Ex-UK's whole
 * messaging metaphor is already WhatsApp-flavored (see ConciergeWhatsAppCta / the WhatsApp order
 * CTA on every card), so this keeps that icon/label while still routing to the real in-app inbox
 * instead of bouncing a shopper out to WhatsApp with no product context.
 */
export function ExUkBottomTabBar() {
  const pathname = usePathname();
  const { matches } = useExUkMatches();
  const { threads, lastRead } = useExUkInbox();

  // Unread = the thread has messages newer than the shopper's last visit to it — not merely
  // "has no messages yet", which would flag nearly every fresh match as unread forever.
  const unreadCount = matches.filter((m) => {
    const thread = threads[m.handle];
    return Boolean(thread) && thread.updatedAt > (lastRead[m.handle] ?? 0);
  }).length;
  const onSearch = pathname?.startsWith("/ex-uk/search") ?? false;
  const onMessages = pathname?.startsWith("/ex-uk/messages") ?? false;
  const onHome = !onSearch && !onMessages;
  // The individual conversation is its own full-page screen (see ex-uk-conversation.tsx's own
  // doc comment) — hide the tab bar there so it doesn't compete with the chat's input bar.
  const isConversation = /^\/ex-uk\/messages\/[^/]+$/.test(pathname ?? "");

  if (isConversation) return null;

  const inactiveClass = "text-[#8a8378] hover:text-[#3f3a33]";
  const activeClass = "bg-accent text-accent-foreground";

  return (
    // A floating capsule (not a full-width bar) — the light chip color is a fixed literal
    // rather than a semantic token, since it's meant to read as chrome sitting on top of the
    // Ex-UK app's dark surface (theme-ex-uk-dark) regardless of theme, not as page content.
    <nav
      aria-label="Ex-UK"
      className="flex shrink-0 justify-center px-4 pb-3 pt-2"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="flex items-center gap-1.5 rounded-control bg-[#f3ede3] p-1.5 shadow-lg">
        <Link
          href="/ex-uk"
          aria-label="Home"
          aria-current={onHome ? "page" : undefined}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition ${onHome ? activeClass : inactiveClass}`}
        >
          <HomeIcon className="h-5 w-5" filled={onHome} />
        </Link>
        <Link
          href="/ex-uk/search"
          aria-label="Search"
          aria-current={onSearch ? "page" : undefined}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition ${onSearch ? activeClass : inactiveClass}`}
        >
          <SearchIcon className="h-5 w-5" />
        </Link>
        <Link
          href="/ex-uk/messages"
          aria-label="WhatsApp"
          aria-current={onMessages ? "page" : undefined}
          className={`relative flex h-11 w-11 items-center justify-center rounded-full transition ${onMessages ? activeClass : inactiveClass}`}
        >
          <WhatsAppIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground ring-2 ring-[#f3ede3]">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}
