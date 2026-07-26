import type { MetadataRoute } from "next";
import { OG_THEME } from "@/lib/og-theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nuru Admin",
    short_name: "NURU Admin",
    description: "Business records and invoicing for Nuru Electronics.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: OG_THEME.background,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
