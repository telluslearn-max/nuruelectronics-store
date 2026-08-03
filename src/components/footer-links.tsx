import Link from "next/link";
import { categories } from "@/lib/categories";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export function FooterLinks() {
  return (
    <div className="grid grid-cols-2 gap-8">
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
          <li>
            <Link href="/trade-in" className="hover:text-foreground">
              Trade-In
            </Link>
          </li>
          <li>
            <Link href="/gift-cards" className="hover:text-foreground">
              Gift Cards
            </Link>
          </li>
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
          <li>
            <Link href="/about" className="hover:text-foreground">
              About us
            </Link>
          </li>
          <li>
            <Link href="/blog" className="hover:text-foreground">
              Blog
            </Link>
          </li>
          <li>
            <Link href="/wishlist" className="hover:text-foreground">
              Wishlist
            </Link>
          </li>
          <li>
            <Link href="/cart" className="hover:text-foreground">
              Cart
            </Link>
          </li>
          <li>
            <Link href="/returns" className="hover:text-foreground">
              Returns
            </Link>
          </li>
          <li>
            <Link href="/careers" className="hover:text-foreground">
              Careers
            </Link>
          </li>
        </ul>
      </div>
      <div>
        <p className="text-sm font-medium">Legal</p>
        <ul className="mt-3 space-y-2 text-sm text-neutral-500">
          <li>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link href="/legal/refund-policy" className="hover:text-foreground">
              Refund & Warranty Policy
            </Link>
          </li>
          <li>
            <Link href="/legal/bnpl-terms" className="hover:text-foreground">
              BNPL Credit Terms
            </Link>
          </li>
          <li>
            <Link href="/legal/cookie-policy" className="hover:text-foreground">
              Cookie Policy
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
