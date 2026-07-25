import { ImageResponse } from "next/og";
import { OG_THEME } from "@/lib/og-theme";

export const alt = "NURU — genuine electronics in Kenya: phones, laptops, audio, gaming, cameras, and appliances";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: OG_THEME.background,
          color: OG_THEME.foreground,
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -4, display: "flex" }}>
          NURU
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: OG_THEME.accent,
              marginTop: 100,
              marginLeft: 8,
            }}
          />
        </div>
        <div style={{ fontSize: 34, color: OG_THEME.muted, marginTop: 16 }}>
          Phones, laptops, audio, gaming, cameras &amp; appliances
        </div>
      </div>
    ),
    { ...size },
  );
}
