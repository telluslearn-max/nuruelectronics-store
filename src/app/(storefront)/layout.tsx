import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { AnnouncementBar } from "@/components/announcement-bar";
import { CartProvider } from "@/components/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { ConciergeWidget } from "@/components/concierge/concierge-widget";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { getCart } from "@/lib/actions";
import { getConversationHistory } from "@/lib/concierge/history";
import { isConciergeConfigured } from "@/lib/concierge/vertex-client";
import { getCurrentCustomer } from "@/lib/customer";
import { isCustomerAuthConfigured } from "@/lib/customer-auth";
import { isFirestoreConfigured } from "@/lib/firebase-admin";

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

  return (
    <CartProvider initialCart={cart}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
      >
        Skip to content
      </a>
      <GoogleAnalytics />
      <AnnouncementBar />
      <Nav authEnabled={isCustomerAuthConfigured} customerName={customer?.displayName ?? null} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <Footer />
      <CartDrawer />
      <ConciergeWidget enabled={isConciergeConfigured} initialMessages={conciergeHistory} />
    </CartProvider>
  );
}
