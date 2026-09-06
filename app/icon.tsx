import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The favicon — the real THO mark, not a drawing of one.
 *
 * This used to render a white `✂` on rausch, because when it was written the only copy of
 * the logo was `public/tho-logo.webp` and Next's icon convention takes `.ico`, `.jpg`,
 * `.png` and `.svg` but not WebP. That constraint is gone: `assets/tho-logo.png` exists for
 * `app/opengraph-image.tsx`, which hit the same wall first and solved it by keeping one PNG
 * re-encode in the repo. Reading the same file here costs no new binary and cannot drift
 * from the share card, since both read the one asset.
 *
 * **Circle-cropped, because that is the only shape this mark is ever shown in** — both
 * headers, both footers, `BrandLockup` and the OG card all render it `rounded-full
 * object-cover`. The artwork itself is a fully opaque red square, so without the crop the
 * tab would be the one place the mark had corners.
 *
 * `app/favicon.ico` carries the same artwork at 16/32/48 for the browsers and crawlers that
 * request `/favicon.ico` directly rather than reading the `<link>`. Regenerate the pair
 * together if the mark ever changes — see the note in `app/opengraph-image.tsx` for the
 * WebP → PNG step, then rebuild the `.ico` from `assets/tho-logo.png`.
 *
 * ## 96px, because Google Search will not take 32
 *
 * This was 32×32, which is the conventional favicon size and the wrong one here: Google
 * requires the icon it shows beside a search result to be **square and a multiple of 48px**
 * — 48, 96, 144, 192 — and silently declines anything else, falling back to whatever it
 * cached before or to the default globe. The `.ico`'s 48px frame already qualified, but a
 * site that also advertises a non-conforming `<link rel="icon">` is asking Google's picker
 * to choose between them, and there is no reason to make that a coin flip.
 *
 * 96 rather than the minimum 48 so a hidpi tab has real pixels to render, and rather than
 * the source's own 192 so the tab is not downloading a 60 KB image to draw at 16px.
 */

export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default async function Icon() {
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
          // Half the box, so the tile is a circle — the same crop `BrandLockup` and the
          // OG card apply.
          style={{ borderRadius: size.width / 2, objectFit: "cover" }}
        />
      </div>
    ),
    size,
  );
}
