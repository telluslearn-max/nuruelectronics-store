import { ImageResponse } from "next/og";

export const alt = "NURU — Samsung Galaxy phones, tablets, audio, and wearables in Kenya";
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
          backgroundColor: "#0a0a0a",
          color: "#f5f5f7",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -4, display: "flex" }}>
          NURU
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: "#d4472e",
              marginTop: 100,
              marginLeft: 8,
            }}
          />
        </div>
        <div style={{ fontSize: 34, color: "#a1a1aa", marginTop: 16 }}>
          Samsung Galaxy phones, tablets, audio &amp; wearables
        </div>
      </div>
    ),
    { ...size },
  );
}
