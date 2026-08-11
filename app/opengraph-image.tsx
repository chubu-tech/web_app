import { ImageResponse } from "next/og";
import { brand, hero } from "@/lib/marketing/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${brand.name} — ${brand.tagline}`;

/**
 * Social share card, generated at build time. Text-only so it never depends on
 * a remote fetch, and it uses the renderer's built-in font — satori cannot
 * parse our variable Inter file.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f6f3ee",
          padding: "72px 80px",
        }}
      >
        {/* Brand row. */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#ff385c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 34,
            }}
          >
            ✂
          </div>
          <div style={{ fontSize: 34, color: "#222222", letterSpacing: -0.5 }}>
            {brand.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 92,
              lineHeight: 1.02,
              color: "#222222",
              letterSpacing: -3,
            }}
          >
            Book your chair.
          </div>
          <div
            style={{
              fontSize: 92,
              lineHeight: 1.02,
              color: "#ff385c",
              letterSpacing: -3,
            }}
          >
            Skip the wait.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.4,
              color: "#3f3f3f",
              maxWidth: 940,
            }}
          >
            {hero.purpose}
          </div>
        </div>

        {/* Kira-weave rule, echoing the page. */}
        <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: 120, background: "#722030" }} />
          <div style={{ width: 44, background: "#e8a33d" }} />
          <div style={{ width: 180, background: "#ff385c" }} />
          <div style={{ width: 24, background: "#e8a33d" }} />
          <div style={{ width: 96, background: "#1f6f5c" }} />
          <div style={{ width: 36, background: "#722030" }} />
          <div style={{ width: 200, background: "#e8a33d" }} />
        </div>
      </div>
    ),
    size,
  );
}
