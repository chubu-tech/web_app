import { ImageResponse } from "next/og";

/**
 * The favicon, generated rather than shipped as a file.
 *
 * There was no icon of any kind — no `favicon.ico`, no `icon.png`, nothing in `public/`
 * that Next's file conventions pick up — so every browser tab, bookmark and search result
 * for this domain rendered the default globe. That is a small thing that shows up in a
 * large number of places, including beside the title in a Google result.
 *
 * **Generated, because the one asset available cannot be used here.** `public/tho-logo.webp`
 * is the mark, and Next's icon convention accepts `.ico`, `.jpg`, `.png` and `.svg` — not
 * WebP. Re-encoding it to PNG would add a binary to the repo that has to be kept in step
 * with the WebP by hand; drawing it costs one file and stays in step by construction,
 * since both read the same brand colour.
 *
 * The glyph matches `app/opengraph-image.tsx` — a white scissors on rausch — so the tab
 * icon and the share card are recognisably one product.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // `--color-rausch`. Not the CTA variant: this is a mark, not text on a button,
          // so the contrast rule that forces the deeper hue does not apply.
          background: "#ff385c",
          color: "#ffffff",
          fontSize: 22,
          borderRadius: 6,
        }}
      >
        ✂
      </div>
    ),
    size,
  );
}
