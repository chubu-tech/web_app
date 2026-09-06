import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The iOS home-screen icon. Same mark as `app/icon.tsx`, at the size iOS asks for.
 *
 * Separate from the favicon because the two differ in more than pixels: iOS renders this
 * at 180px with its own mask and **no transparency**, so the artwork is left full-bleed
 * here rather than circle-cropped the way the tab icon is. Cropping it ourselves would
 * show as a circle inside iOS's rounded square, with the home screen's background in the
 * corners — the mark's own opaque red is what should reach the mask's edge.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await readFile(join(process.cwd(), "assets", "tho-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt=""
          width={size.width}
          height={size.height}
          style={{ objectFit: "cover" }}
        />
      </div>
    ),
    size,
  );
}
