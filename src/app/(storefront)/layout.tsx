import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { AnnouncementBar } from "@/components/announcement-bar";
import { CartProvider } from "@/components/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CompareProvider } from "@/components/compare/compare-context";
import { CompareTray } from "@/components/compare/compare-tray";
import { ConciergeWidget } from "@/components/concierge/concierge-widget";
import { Footer } from "@/components/footer";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { Nav } from "@/components/nav";
import { SeasonalDecoration } from "@/components/seasonal/seasonal-decoration";
import { WishlistProvider } from "@/components/wishlist/wishlist-context";
import { getCart } from "@/lib/actions";
import { getConversationHistory } from "@/lib/concierge/history";
import { isConciergeConfigured } from "@/lib/concierge/vertex-client";
import { getCurrentCustomer } from "@/lib/customer";
import { isCustomerAuthConfigured } from "@/lib/customer-auth";
import { isFirestoreConfigured } from "@/lib/firebase-admin";
import { getActiveSeasonalTheme } from "@/lib/seasonal-theme";

export default async function StorefrontLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cart, customer] = await Promise.all([
    getCart(),
    isCustomerAuthConfigured ? getCurrentCustomer() : Promise.resolve(null),
  ]);
  // Sequential, not parallel with the above — reuses customer.id rather than
  // validating the session token twice. Only signed-in shoppers pay this extra
  // round trip; guests (the common case) skip it entirely.
  const conciergeHistory = customer && isFirestoreConfigured ? await getConversationHistory(customer.id) : [];
  const activeSeasonalTheme = getActiveSeasonalTheme();

  return (
    <CartProvider initialCart={cart}>
      <CompareProvider>
        <WishlistProvider>
          {/* `contents` keeps this wrapper from breaking `body`'s `flex flex-col` layout (which
              `main`'s flex-1 relies on) and from becoming a fixed-position containing block for
              the tree's several `fixed` descendants (CartDrawer, ConciergeWidget, MobileTabBar,
              CompareTray) — it exists only to scope the seasonal theme's CSS variables. */}
          <div className={activeSeasonalTheme ? `contents ${activeSeasonalTheme.className}` : "contents"}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
            >
              Skip to content
            </a>
            <GoogleAnalytics />
            <SeasonalDecoration theme={activeSeasonalTheme} />
            <AnnouncementBar seasonalTheme={activeSeasonalTheme} />
            <Nav authEnabled={isCustomerAuthConfigured} customerName={customer?.displayName ?? null} />
            <main
              id="main"
              className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"
              style={{ paddingBottom: "calc(var(--main-pb-base) + (var(--buy-bar-visible) * 4.75rem))" }}
            >
              {children}
            </main>
            <Footer />
            <CartDrawer />
            <ConciergeWidget enabled={isConciergeConfigured} initialMessages={conciergeHistory} />
            <MobileTabBar authEnabled={isCustomerAuthConfigured} customerName={customer?.displayName ?? null} />
            <CompareTray />
          </div>
        </WishlistProvider>
      </CompareProvider>
    </CartProvider>
  );
}
