import { ImageResponse } from "next/og";
import { getEcosystem } from "@/lib/collections";
import { truncate } from "@/lib/format";
import { OG_THEME } from "@/lib/og-theme";

export const alt = "Brand";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ecosystem = getEcosystem(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: OG_THEME.background,
          color: OG_THEME.foreground,
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
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1 }}>
            {ecosystem?.label ?? "NURU"}
          </div>
          {ecosystem && (
            <div style={{ fontSize: 34, color: OG_THEME.muted, marginTop: 20, maxWidth: 900 }}>
              {truncate(ecosystem.blurb, 90)}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
