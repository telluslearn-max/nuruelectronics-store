import { ImageResponse } from "next/og";
import { formatPrice } from "@/lib/format";
import { OG_THEME } from "@/lib/og-theme";
import { getProductByHandle } from "@/lib/shopify";

export const alt = "Product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  const price = product?.priceRange.minVariantPrice;
  const image = product?.images[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: OG_THEME.background,
          color: OG_THEME.foreground,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 80,
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1, display: "flex" }}>
            NURU
            <div
              style={{
                width: 10,
                height: 10,
                backgroundColor: OG_THEME.accent,
                marginTop: 38,
                marginLeft: 4,
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1 }}>
              {product?.title ?? "NURU"}
            </div>
            {price && (
              <div style={{ fontSize: 36, color: OG_THEME.muted, marginTop: 20 }}>
                {`From ${formatPrice(price.amount, price.currencyCode)}`}
              </div>
            )}
          </div>
        </div>
        {image && <img src={image.url} alt="" width={470} height={630} style={{ objectFit: "cover" }} />}
      </div>
    ),
    { ...size },
  );
}
