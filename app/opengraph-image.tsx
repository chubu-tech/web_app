import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand, hero } from "@/lib/marketing/content";
import { SHARE_CARD, SHARE_CARD_ALT } from "@/lib/seo";

/*
  Declared once in `lib/seo.ts` and read here, rather than written here and copied there.

  `shareCard()` has to emit `og:image:width` and `og:image:height` explicitly — the file
  convention only fills those in for pages that override nothing — and Facebook and
  WhatsApp crop against the declared ratio. So if these two numbers and that helper's
  ever disagreed, every share card on the domain would be cropped to a size this image
  is not. One constant means they cannot.
*/
export const size = { width: SHARE_CARD.width, height: SHARE_CARD.height };
export const contentType = SHARE_CARD.contentType;
export const alt = SHARE_CARD_ALT;

/** A design pixel, in emitted pixels. See the note on the default export. */
const px = (n: number) => n * SHARE_CARD.scale;

/**
 * Social share card, generated at build time. Every input comes from the repo, so it never
 * depends on a remote fetch, and it uses the renderer's built-in font — satori cannot
 * parse our variable Inter file.
 *
 * ## Every measurement below goes through `px()`
 *
 * The card is **drawn at 1200×630 and emitted at `SHARE_CARD.scale`×**, because every
 * surface that shows it downscales it — WhatsApp Web crops it to roughly a 100 px square —
 * and resampling from more source pixels is the difference between legible 30 px body copy
 * and a grey smear. Satori rasterises from an SVG, so this is a genuine resolution
 * increase and not an upscale: the glyphs are re-rendered at the larger size.
 *
 * The literals are kept at their **design** values so the layout still reads the way it was
 * composed, and `px()` is the only thing that knows about density. Bare numbers are the
 * trap here: one unscaled `fontSize` in a scaled card is a line of type at half size, which
 * builds and lints clean and is only visible in the finished PNG. If you add a measurement,
 * wrap it.
 *
 * Unitless values are deliberately left alone — `lineHeight` is a multiplier, and
 * `borderRadius: 999` is a "fully round" sentinel that scaling would only make sillier.
 */
export default async function Image() {
  /*
    The real brand mark, inlined.

    **`assets/tho-logo.png` and not `public/tho-logo.webp`, which is the same artwork.**
    Satori cannot decode WebP — pointing it at the `.webp` fails the prerender outright
    with `TypeError: u2 is not iterable`, which is its image-size parser giving up, so the
    build goes red rather than the card losing its logo quietly. PNG is what it reads.

    It lives in `assets/` rather than `public/` because nothing serves it: it is a
    build-time input to this one file, and a second logo in `public/` would look like a
    second logo rather than a format conversion. `process.cwd()` is the project root during
    the build, which is the pattern Next documents for exactly this.

    Regenerate it from the WebP if the mark ever changes — they must not drift:

        npx sharp -i public/tho-logo.webp -o assets/tho-logo.png

    Read here and base64'd rather than fetched, keeping the promise in the note above: this
    card renders from the repo and never depends on the network.
  */
  const logo = await readFile(join(process.cwd(), "assets", "tho-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

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
          padding: `${px(72)}px ${px(80)}px`,
        }}
      >
        {/* Brand row. */}
        <div style={{ display: "flex", alignItems: "center", gap: px(20) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            width={px(64)}
            height={px(64)}
            // Half the box: a circle with the artwork cropped into it, which is exactly
            // how `BrandLockup` and both headers render it (`rounded-full object-cover`).
            style={{ borderRadius: px(32), objectFit: "cover" }}
          />
          <div style={{ fontSize: px(34), color: "#222222", letterSpacing: px(-0.5) }}>
            {brand.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: px(92),
              lineHeight: 1.02,
              color: "#222222",
              letterSpacing: px(-3),
            }}
          >
            Book your chair.
          </div>
          <div
            style={{
              fontSize: px(92),
              lineHeight: 1.02,
              color: "#ff385c",
              letterSpacing: px(-3),
            }}
          >
            Skip the wait.
          </div>
          <div
            style={{
              marginTop: px(28),
              fontSize: px(30),
              lineHeight: 1.4,
              color: "#3f3f3f",
              maxWidth: px(940),
            }}
          >
            {hero.purpose}
          </div>
        </div>

        {/* Kira-weave rule, echoing the page. */}
        <div style={{ display: "flex", height: px(10), borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: px(120), background: "#722030" }} />
          <div style={{ width: px(44), background: "#e8a33d" }} />
          <div style={{ width: px(180), background: "#ff385c" }} />
          <div style={{ width: px(24), background: "#e8a33d" }} />
          <div style={{ width: px(96), background: "#1f6f5c" }} />
          <div style={{ width: px(36), background: "#722030" }} />
          <div style={{ width: px(200), background: "#e8a33d" }} />
        </div>
      </div>
    ),
    size,
  );
}
