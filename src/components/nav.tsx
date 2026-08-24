"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getNavEntries } from "@/lib/nav-entries";
import { isRouteActive } from "@/lib/route-active";
import { useWishlist } from "./wishlist/wishlist-context";
import { useCart } from "./cart/cart-context";
import { SearchBox } from "./search-box";
import { useMediaQuery } from "./use-media-query";

/** Matches Tailwind's `md` breakpoint, which is what gates the desktop vs. mobile SearchBox below. */
const IS_DESKTOP_QUERY = "(min-width: 768px)";

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 8"
      className={className ?? "h-2.5 w-2.5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1.5 6 6.5 11 1.5" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.7-10-9.3C.6 8 1.9 4.5 5 3.4c2-.7 4 0 5.5 1.9C12 3.4 14 2.7 16 3.4c3.1 1.1 4.4 4.6 3 7.8-2.5 4.6-10 9.3-10 9.3Z" />
    </svg>
  );
}

export function Nav({
  authEnabled,
  customerName,
}: {
  authEnabled: boolean;
  customerName: string | null;
}) {
  const { cart, openCart } = useCart();
  const { items: wishlistItems } = useWishlist();
  const pathname = usePathname();
  const itemCount = cart?.totalQuantity ?? 0;
  const isDesktop = useMediaQuery(IS_DESKTOP_QUERY);
  const [openId, setOpenId] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const entries = getNavEntries();
  const activeEntry = entries.find((e) => e.id === openId);

  function open(id: string) {
    clearTimeout(closeTimer.current);
    setOpenId(id);
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpenId(null), 180);
  }
  function cancelClose() {
    clearTimeout(closeTimer.current);
  }

  useEffect(() => {
    // Intentional: this is the standard "reset UI state on navigation" pattern, not derived
    // render state — there's no render-time equivalent to "close the dropdown when the route
    // changes." eslint-disable rather than restructured, to avoid touching working nav behavior
    // with no test coverage over it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId(null);
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenId(null);
      }
    }
    function handlePointerDown(e: PointerEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenId(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      // isolate + will-change-transform force this sticky+backdrop-blur header onto its own
      // compositor layer, which some browsers otherwise fail to fully re-rasterize on scroll —
      // leaving a stale blurred "ghost" of the page content baked into the bar (audit finding M2).
      className="sticky top-0 z-40 isolate w-full border-b border-border-subtle bg-background/80 backdrop-blur will-change-transform"
    >
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
            NURU
          </Link>
          <div className="hidden min-w-0 flex-1 md:block" aria-hidden={isDesktop === undefined ? undefined : !isDesktop}>
            <SearchBox />
          </div>
          <div className="ml-auto hidden shrink-0 items-center gap-2 md:ml-0 md:flex md:gap-4">
            {authEnabled && (
              <Link
                href={customerName ? "/account" : "/api/auth/login"}
                className="shrink-0 whitespace-nowrap text-sm font-medium text-neutral-600 transition hover:text-foreground"
              >
                {customerName ? customerName.split(" ")[0] : "Sign in"}
              </Link>
            )}
            <Link
              href="/account"
              aria-label={`Wishlist${wishlistItems.length > 0 ? `, ${wishlistItems.length} items` : ""}`}
              className="relative shrink-0 rounded-control border border-border-subtle p-2 transition hover:border-foreground"
            >
              <HeartIcon className="h-5 w-5" />
              {wishlistItems.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-control bg-accent text-xs text-accent-foreground">
                  {wishlistItems.length}
                </span>
              )}
            </Link>
            <button
              onClick={openCart}
              aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
              className="relative shrink-0 rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground"
            >
              Cart
              {itemCount > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-control bg-accent text-xs text-accent-foreground">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 md:hidden" aria-hidden={isDesktop === undefined ? undefined : isDesktop}>
          <SearchBox />
        </div>
      </div>

      {/* Desktop: flat bar with hover/click mega-menu dropdowns */}
      <nav aria-label="Categories" className="relative hidden border-t border-border-subtle/60 md:block">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-6 whitespace-nowrap py-2.5 text-sm">
            {entries.map((entry) => {
              const isCurrent = isRouteActive(pathname, entry.href);
              const isOpen = openId === entry.id;
              return (
                <li
                  key={entry.id}
                  className="relative"
                  onMouseEnter={() => open(entry.id)}
                  onMouseLeave={scheduleClose}
                >
                  <div className="flex items-center gap-0.5">
                    <Link
                      href={entry.href}
                      aria-current={isCurrent ? "page" : undefined}
                      className={
                        // Ex-UK gets a standing accent treatment (not just on hover/active) —
                        // otherwise it reads as just another flat-text peer of Shop/Brand/Need/
                        // Support and shoppers have no reason to notice it exists.
                        entry.id === "ex-uk"
                          ? "font-medium text-accent"
                          : isCurrent
                            ? "font-medium text-foreground"
                            : "text-neutral-500 transition hover:text-foreground"
                      }
                    >
                      {entry.label}
                    </Link>
                    {entry.panelItems.length > 0 && (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-haspopup="true"
                        aria-controls={`megamenu-${entry.id}`}
                        onClick={() => open(entry.id)}
                        className="inline-flex shrink-0 p-0.5 text-neutral-400 transition hover:text-foreground"
                      >
                        <ChevronIcon />
                        <span className="sr-only">Toggle {entry.label} menu</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {activeEntry && activeEntry.panelItems.length > 0 && (
          <div
            id={`megamenu-${activeEntry.id}`}
            role="menu"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute inset-x-0 top-full z-50 border-b border-border-subtle bg-background shadow-lg"
          >
            <div className="mx-auto max-w-6xl px-4 py-4">
              <ul className="flex flex-wrap gap-x-8 gap-y-2">
                {activeEntry.panelItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      role="menuitem"
                      className="block text-sm text-neutral-600 transition hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
