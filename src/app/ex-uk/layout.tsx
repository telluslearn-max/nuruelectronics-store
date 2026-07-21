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
      <div className="flex h-dvh flex-col bg-background">
        {children}
        <ExUkBottomTabBar />
      </div>
    </CartProvider>
  );
}
