import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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

// Fallback for any route that doesn't set its own metadata (cart, wishlist, search, compare,
// coming-soon, legal pages) — was a bare "NURU" with no entity signal for what the brand
// actually is (SEO/AEO audit finding). Pages that already export their own metadata (home,
// category, product, ecosystem, etc.) are unaffected by this default.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NURU — Genuine Electronics in Kenya",
    template: "%s | NURU",
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NURU",
    locale: "en_KE",
    title: "NURU — Genuine Electronics in Kenya",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "NURU — Genuine Electronics in Kenya",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  viewportFit: "cover",
  // Next.js only fills these in when there's no `viewport` export at all — once you add one
  // (themeColor/viewportFit above), it replaces the default rather than merging with it, so
  // width/initialScale have to be spelled out here too. Missing them meant every page (including
  // the content-heavy admin reports) rendered at the desktop-ish default viewport width and got
  // shrunk to fit, forcing a pinch-zoom-out to read anything — not specific to Capital Circle,
  // just most noticeable there.
  width: "device-width",
  initialScale: 1,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        {children}
      </body>
    </html>
  );
}
