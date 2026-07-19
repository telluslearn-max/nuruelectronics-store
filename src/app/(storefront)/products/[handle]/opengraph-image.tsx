import { ImageResponse } from "next/og";
import { formatPrice } from "@/lib/format";
import { getProductByHandle } from "@/lib/shopify";

export const alt = "Product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  const price = product?.priceRange.minVariantPrice;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          color: "#f5f5f7",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1, display: "flex" }}>
          NURU
          <div
            style={{
              width: 10,
              height: 10,
              backgroundColor: "#d4472e",
              marginTop: 38,
              marginLeft: 4,
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1 }}>
            {product?.title ?? "NURU"}
          </div>
          {price && (
            <div style={{ fontSize: 40, color: "#a1a1aa", marginTop: 20 }}>
              {`From ${formatPrice(price.amount, price.currencyCode)}`}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
