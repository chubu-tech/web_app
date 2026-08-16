import { ImageResponse } from "next/og";

/**
 * The iOS home-screen icon. Same mark as `app/icon.tsx`, at the size iOS asks for.
 *
 * Separate from the favicon because the two differ in more than pixels: iOS renders this
 * at 180px with its own mask and **no transparency**, so the background has to be painted
 * rather than inherited, and the corner radius is applied by the OS — drawing our own
 * would show as a rounded square inside a rounded square.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ff385c",
          color: "#ffffff",
          fontSize: 116,
        }}
      >
        ✂
      </div>
    ),
    size,
  );
}
