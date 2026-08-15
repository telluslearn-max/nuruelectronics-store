import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/cart-context";
import { ExUkBottomTabBar } from "@/components/ex-uk/ex-uk-bottom-tab-bar";
import { getCart } from "@/lib/actions";

export const metadata: Metadata = {
  title: { default: "Ex-UK", template: "%s | Ex-UK" },
};

/**
 * Deliberately its own top-level route (outside the (storefront) group), so Ex-UK gets a
 * full-screen, app-like shell instead of the normal site header/footer/announcement bar.
 * Still wraps CartProvider — the per-product chat's checkout/add-to-cart tool results update
 * the same real Shopify cart, even though this shell never shows a cart drawer of its own.
 */
export default async function ExUkLayout({ children }: { children: React.ReactNode }) {
  const cart = await getCart();

  return (
    <CartProvider initialCart={cart}>
      {/* On phones the column fills the viewport exactly like any other page, so the neutral
          backdrop never shows. On wider screens it caps to a phone-width column against a
          contrasting backdrop instead of stretching the swipe cards, drag gestures, and bottom
          tab bar across the full browser width — the "app-like shell" this route is meant to be,
          not the whole page. */}
      <div className="flex h-dvh justify-center bg-neutral-100 sm:py-6">
        <div className="flex h-full w-full max-w-md flex-col bg-background sm:rounded-card sm:shadow-lg">
          {children}
          <ExUkBottomTabBar />
        </div>
      </div>
    </CartProvider>
  );
}
