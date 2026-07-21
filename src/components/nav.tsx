"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { categories } from "@/lib/categories";
import { getFeaturedEcosystems, kits } from "@/lib/collections";
import { useCart } from "./cart/cart-context";
import { SearchBox } from "./search-box";

type PanelLink = { href: string; label: string };
type NavEntry = { id: string; label: string; href: string; panelItems: PanelLink[] };

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

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 20 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1.5" x2="19" y2="1.5" />
      <line x1="1" y1="8" x2="19" y2="8" />
      <line x1="1" y1="14.5" x2="19" y2="14.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="15" y2="15" />
      <line x1="15" y1="1" x2="1" y2="15" />
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
  const pathname = usePathname();
  const itemCount = cart?.totalQuantity ?? 0;
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const entries: NavEntry[] = [
    { id: "shop", label: "Shop", href: "/shop", panelItems: [] },
    ...categories.map((category) => ({
      id: `category-${category.slug}`,
      label: category.label,
      href: `/category/${category.slug}`,
      panelItems: (category.groups ?? []).map((g) => ({
        href: `/category/${category.slug}?group=${g.slug}`,
        label: g.label,
      })),
    })),
    {
      id: "ecosystems",
      label: "Shop by Brand",
      href: "/ecosystem",
      panelItems: [
        ...getFeaturedEcosystems().map((e) => ({ href: `/ecosystem/${e.slug}`, label: e.label })),
        { href: "/ecosystem", label: "View all brands →" },
      ],
    },
    {
      id: "kits",
      label: "Shop by Need",
      href: "/kit",
      panelItems: kits.map((k) => ({ href: `/kit/${k.slug}`, label: k.label })),
    },
    { id: "ex-uk", label: "Ex-UK", href: "/ex-uk", panelItems: [] },
    { id: "support", label: "Support", href: "/support", panelItems: [] },
  ];
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
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenId(null);
        setMobileOpen(false);
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

  useEffect(() => {
    document.documentElement.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur"
    >
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMobileOpen(true)}
            className="shrink-0 rounded-control border border-border-subtle p-2 transition hover:border-foreground md:hidden"
          >
            <HamburgerIcon />
          </button>
          <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
            NURU
          </Link>
          <div className="hidden min-w-0 flex-1 sm:block">
            <SearchBox />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0 sm:gap-4">
            {authEnabled && (
              <Link
                href={customerName ? "/account" : "/api/auth/login"}
                className="shrink-0 whitespace-nowrap text-sm font-medium text-neutral-600 transition hover:text-foreground"
              >
                {customerName ? customerName.split(" ")[0] : "Sign in"}
              </Link>
            )}
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
        <div className="mt-3 sm:hidden">
          <SearchBox />
        </div>
      </div>

      {/* Desktop: flat bar with hover/click mega-menu dropdowns */}
      <nav aria-label="Categories" className="relative hidden border-t border-border-subtle/60 md:block">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-6 whitespace-nowrap py-2.5 text-sm">
            {entries.map((entry) => {
              const isCurrent = pathname === entry.href;
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
                        isCurrent
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

    {/* Mobile: hamburger-triggered slide-in drawer with accordion categories.
        Rendered outside <header> because backdrop-blur on the header
        establishes a containing block for position:fixed descendants,
        which would otherwise confine this drawer to the header's own
        height instead of the full viewport. */}
    <div className={`fixed inset-0 z-[60] md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          aria-hidden={!mobileOpen}
          className={`absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-background shadow-xl transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-border-subtle p-4">
            <span className="text-sm font-medium">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="p-1 text-neutral-500 transition hover:text-foreground"
            >
              <CloseIcon />
            </button>
          </div>
          <ul>
            {entries.map((entry) => {
              const isCurrent = pathname === entry.href;
              const isExpanded = expandedIds.has(entry.id);
              return (
                <li key={entry.id} className="border-b border-border-subtle/60">
                  <div className="flex items-center">
                    <Link
                      href={entry.href}
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={`flex-1 px-4 py-3 text-sm ${
                        isCurrent ? "font-medium text-foreground" : "text-neutral-700"
                      }`}
                    >
                      {entry.label}
                    </Link>
                    {entry.panelItems.length > 0 && (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`mobile-panel-${entry.id}`}
                        onClick={() => toggleExpanded(entry.id)}
                        className="p-4 text-neutral-400 transition hover:text-foreground"
                      >
                        <ChevronIcon className={`h-2.5 w-2.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        <span className="sr-only">Toggle {entry.label} submenu</span>
                      </button>
                    )}
                  </div>
                  {entry.panelItems.length > 0 && isExpanded && (
                    <ul id={`mobile-panel-${entry.id}`} className="space-y-1 bg-neutral-50 px-6 py-2">
                      {entry.panelItems.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className="block py-2 text-sm text-neutral-600 transition hover:text-foreground"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
