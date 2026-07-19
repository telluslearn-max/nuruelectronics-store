import { ImageResponse } from "next/og";
import { getCategory } from "@/lib/categories";
import { truncate } from "@/lib/format";

export const alt = "Category";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);

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
            {category?.label ?? "NURU"}
          </div>
          {category && (
            <div style={{ fontSize: 34, color: "#a1a1aa", marginTop: 20, maxWidth: 900 }}>
              {truncate(category.blurb, 90)}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
