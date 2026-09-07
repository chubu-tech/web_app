import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/lib/marketing/content";
import { APP_SHARE_CARD } from "@/lib/seo";

const size = { width: APP_SHARE_CARD.width, height: APP_SHARE_CARD.height };

/**
 * Prerendered, so the PNG is built once and served from the edge rather than rasterised
 * per unfurl. Nothing in it varies by request.
 */
export const dynamic = "force-static";

/** A design pixel, in emitted pixels. Same convention as `app/opengraph-image.tsx`. */
const px = (n: number) => n * APP_SHARE_CARD.scale;

/**
 * `/app`'s share card — what WhatsApp, Messenger, Facebook, LinkedIn and X render when
 * somebody shares the download link.
 *
 * Drawn at 1200×630 and emitted at `APP_SHARE_CARD.scale`×, and **every measurement goes
 * through `px()`**. A bare number here is a line of type at half size that builds clean,
 * lints clean, and is only visible in the finished PNG. Unitless values — `lineHeight`,
 * the `999` round sentinel — are left alone deliberately.
 *
 * ## The composition is centred on purpose
 *
 * See `APP_SHARE_CARD`: the square crop these platforms fall back to takes the middle
 * ~53% of the width, so a left-aligned card loses its own logo. Everything here sits
 * inside that centre column.
 *
 * ## No store badges, and that is deliberate
 *
 * Apple and Google both publish trademark rules for their download badges, including
 * exact artwork, clear space and minimum sizes, and neither permits a redrawn imitation.
 * Satori cannot render their official SVGs. The honest version of the same message is the
 * sentence — *"Free on iPhone and Android"* — which carries the fact without borrowing
 * anybody's mark, and reads at thumbnail size where a pair of badges would not.
 *
 * The mark is `assets/tho-logo.png` for the same reason `app/opengraph-image.tsx` uses it:
 * satori cannot decode the WebP in `public/`. See that file's note before changing it.
 */
export async function GET() {
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
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f3ee",
          padding: `${px(64)}px ${px(80)}px`,
        }}
      >
        {/* Brand row — mark and wordmark together, so a square crop keeps both. */}
        <div style={{ display: "flex", alignItems: "center", gap: px(20) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            width={px(76)}
            height={px(76)}
            // Half the box: the circle every other rendering of the mark uses.
            style={{ borderRadius: px(38), objectFit: "cover" }}
          />
          <div
            style={{
              fontSize: px(46),
              color: "#222222",
              letterSpacing: px(-0.5),
              fontWeight: 700,
            }}
          >
            {brand.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: px(46),
          }}
        >
          <div
            style={{
              fontSize: px(78),
              lineHeight: 1.04,
              color: "#222222",
              letterSpacing: px(-2.5),
            }}
          >
            Book the chair.
          </div>
          <div
            style={{
              fontSize: px(78),
              lineHeight: 1.04,
              color: "#ff385c",
              letterSpacing: px(-2.5),
            }}
          >
            Skip the wait.
          </div>
        </div>

        {/*
          The one fact this card exists to carry. Kept to a single short line: at the
          thumbnail size WhatsApp renders, a second line of body copy is a grey smear.
        */}
        <div
          style={{
            marginTop: px(34),
            fontSize: px(31),
            lineHeight: 1.4,
            color: "#3f3f3f",
            textAlign: "center",
          }}
        >
          Free on iPhone and Android
        </div>

        {/* Kira-weave rule, echoing the site card and the page. */}
        <div
          style={{
            display: "flex",
            height: px(10),
            marginTop: px(44),
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div style={{ width: px(96), background: "#722030" }} />
          <div style={{ width: px(36), background: "#e8a33d" }} />
          <div style={{ width: px(150), background: "#ff385c" }} />
          <div style={{ width: px(24), background: "#e8a33d" }} />
          <div style={{ width: px(80), background: "#1f6f5c" }} />
          <div style={{ width: px(30), background: "#722030" }} />
          <div style={{ width: px(160), background: "#e8a33d" }} />
        </div>
      </div>
    ),
    size,
  );
}
