import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

// Manrope for display/body — a confident, warm grotesk rather than the
// default Next.js starter face. IBM Plex Mono carries eyebrows, prices, and
// spec labels — a technical face on purpose, tying the type system to the
// catalog it's selling rather than sitting on top of it as decoration.
const sans = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-technical",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
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
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
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
