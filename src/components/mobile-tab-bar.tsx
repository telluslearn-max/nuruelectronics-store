"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./cart/cart-context";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ShopIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 8V6a4 4 0 1 1 8 0v2" />
      <path d="M5.5 8h13l1 12.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5Z" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

function CartIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 4h2l1.2 12.2A1.5 1.5 0 0 0 8.2 17.5h9.4a1.5 1.5 0 0 0 1.48-1.28L20 8H6" />
      <circle cx="9.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
    </svg>
  );
}

export function MobileTabBar({
  authEnabled,
  customerName,
}: {
  authEnabled: boolean;
  customerName: string | null;
}) {
  const pathname = usePathname();
  const { cart, isOpen, openCart } = useCart();
  const itemCount = cart?.totalQuantity ?? 0;

  const isHome = pathname === "/";
  const isShop =
    pathname === "/shop" ||
    pathname.startsWith("/category") ||
    pathname.startsWith("/ecosystem") ||
    pathname.startsWith("/kit");
  const isSearch = pathname.startsWith("/search");
  const isAccount = pathname.startsWith("/account");
  const accountHref = authEnabled ? (customerName ? "/account" : "/api/auth/login") : "/account";

  const tabClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
      active ? "text-foreground" : "text-neutral-400"
    }`;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border-subtle bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Link href="/" className={tabClass(isHome)} aria-current={isHome ? "page" : undefined}>
        <HomeIcon active={isHome} />
        Home
      </Link>
      <Link href="/shop" className={tabClass(isShop)} aria-current={isShop ? "page" : undefined}>
        <ShopIcon active={isShop} />
        Shop
      </Link>
      <Link href="/search" className={tabClass(isSearch)} aria-current={isSearch ? "page" : undefined}>
        <SearchIcon active={isSearch} />
        Search
      </Link>
      <button
        type="button"
        onClick={openCart}
        className={tabClass(isOpen)}
        aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
      >
        <span className="relative">
          <CartIcon active={isOpen} />
          {itemCount > 0 && (
            <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-semibold leading-none text-accent-foreground">
              {itemCount}
            </span>
          )}
        </span>
        Cart
      </button>
      <Link
        href={accountHref}
        className={tabClass(isAccount)}
        aria-current={isAccount ? "page" : undefined}
      >
        <AccountIcon active={isAccount} />
        Account
      </Link>
    </nav>
  );
}
