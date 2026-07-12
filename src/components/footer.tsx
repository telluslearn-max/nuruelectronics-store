import Link from "next/link";
import { categories } from "@/lib/categories";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <p className="text-lg font-semibold tracking-tight">NURU</p>
            <p className="mt-2 max-w-xs text-sm text-neutral-500">
              NURU is a Kenya-based electronics store offering genuine phones, laptops, audio,
              gaming, cameras, appliances, and more from the world&apos;s top brands. Every order
              ships with manufacturer warranty and fast delivery across Kenya.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Shop</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-500">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link href={`/category/${category.slug}`} className="hover:text-foreground">
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Support</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-500">
              <li>
                <Link href="/support" className="hover:text-foreground">
                  Help & Support
                </Link>
              </li>
              {SUPPORT_EMAIL && (
                <li>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground">
                    Contact us
                  </a>
                </li>
              )}
              <li>
                <Link href="/search" className="hover:text-foreground">
                  Search
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-border-subtle pt-6 text-sm text-neutral-400">
          &copy; {new Date().getFullYear()} NURU. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
