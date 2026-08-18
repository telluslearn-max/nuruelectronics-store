import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/cart-context";
import { ExUkBottomTabBar } from "@/components/ex-uk/ex-uk-bottom-tab-bar";
import { WishlistProvider } from "@/components/wishlist/wishlist-context";
import { getCart } from "@/lib/actions";

export const metadata: Metadata = {
  title: { default: "Ex-UK Deals | NURU", template: "%s | Ex-UK" },
};

/**
 * Deliberately its own top-level route (outside the (storefront) group), so Ex-UK gets a
 * full-screen, app-like shell instead of the normal site header/footer/announcement bar.
 * Still wraps CartProvider — the per-product chat's checkout/add-to-cart tool results update
 * the same real Shopify cart, even though this shell never shows a cart drawer of its own.
 * Also wraps WishlistProvider (normally only mounted by the (storefront) layout) — Ex-UK's card
 * bookmark saves to the same site-wide wishlist (nuru:wishlist in localStorage), not a
 * separate Ex-UK-only list, so a saved unit shows up in the regular wishlist page too.
 *
 * An earlier version of this capped the whole shell to a phone-width column on desktop, on the
 * assumption every screen here would stay phone-shaped. That's wrong now that the Discover screen
 * swaps to a real browse grid on sm: and up (ex-uk-discover-screen.tsx) — a grid wants the same
 * kind of width the rest of the site uses, not a fake phone frame, so this caps to the site's own
 * max-w-6xl convention instead (a no-op on phones, which never reach that width anyway).
 */
export default async function ExUkLayout({ children }: { children: React.ReactNode }) {
  const cart = await getCart();

  return (
    <CartProvider initialCart={cart}>
      <WishlistProvider>
        <div className="theme-ex-uk-dark mx-auto flex h-dvh w-full max-w-6xl flex-col bg-background text-foreground">
          {children}
          <ExUkBottomTabBar />
        </div>
      </WishlistProvider>
    </CartProvider>
  );
}
