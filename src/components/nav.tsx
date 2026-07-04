"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { categories } from "@/lib/categories";
import { useCart } from "./cart/cart-context";
import { SearchBox } from "./search-box";

export function Nav() {
  const { cart, openCart } = useCart();
  const pathname = usePathname();
  const itemCount = cart?.totalQuantity ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          NURU
        </Link>
        <SearchBox />
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
      <nav aria-label="Categories" className="border-t border-border-subtle/60">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-6 whitespace-nowrap py-2.5 text-sm">
            {categories.map((category) => {
              const href = `/category/${category.slug}`;
              const isCurrent = pathname === href;
              return (
                <li key={category.slug}>
                  <Link
                    href={href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={
                      isCurrent
                        ? "font-medium text-foreground"
                        : "text-neutral-500 transition hover:text-foreground"
                    }
                  >
                    {category.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </header>
  );
}
