import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  // Both nuruelectronics.com and www.nuruelectronics.com previously served identical content
  // with a 200 and no redirect — only a canonical tag (pointing at the www version, see
  // SITE_URL in src/lib/site.ts) discouraged duplicate indexing, which search engines treat as
  // a soft signal, not a guarantee (SEO/AEO audit finding). This forces a real 301 from the
  // apex to the canonical www host, consolidating link equity onto one URL.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "nuruelectronics.com" }],
        destination: "https://www.nuruelectronics.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
