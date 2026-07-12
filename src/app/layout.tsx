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
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Shop genuine electronics in Kenya at NURU — phones, laptops, audio, gaming, cameras, and appliances from top brands, with fast Nairobi delivery.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NURU",
    template: "%s | NURU",
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NURU",
    locale: "en_KE",
    title: "NURU",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "NURU",
    description: DESCRIPTION,
  },
};

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "NURU",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description: DESCRIPTION,
  areaServed: "KE",
  ...(WHATSAPP_NUMBER
    ? {
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: `+${WHATSAPP_NUMBER}`,
          areaServed: "KE",
        },
      }
    : {}),
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "NURU",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
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
