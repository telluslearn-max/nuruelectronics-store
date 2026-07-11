import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/announcement-bar";
import { CartProvider } from "@/components/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { getCart } from "@/lib/actions";
import { getCurrentCustomer } from "@/lib/customer";
import { isCustomerAuthConfigured } from "@/lib/customer-auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.nuruelectronics.com"),
  title: {
    default: "NURU",
    template: "%s | NURU",
  },
  description:
    "Shop genuine electronics in Kenya at NURU — phones, laptops, audio, gaming, cameras, and appliances from top brands, with fast Nairobi delivery.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cart, customer] = await Promise.all([
    getCart(),
    isCustomerAuthConfigured ? getCurrentCustomer() : Promise.resolve(null),
  ]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider initialCart={cart}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
          >
            Skip to content
          </a>
          <AnnouncementBar />
          <Nav authEnabled={isCustomerAuthConfigured} customerName={customer?.displayName ?? null} />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
