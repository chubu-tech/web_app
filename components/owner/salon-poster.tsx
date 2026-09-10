import { posterFontClass } from "@/lib/poster-fonts";

/**
 * The printable poster — a port of `Tho QR Poster.dc.html` from the Claude Design project
 * `8479738e-09c5-4f7e-a267-576fe9322fee`.
 *
 * ## It is a fixed canvas, and everything else follows from that
 *
 * The design is **1240 × 1754** — exactly A4's √2 ratio, at 150dpi. Every measurement in it
 * is a pixel at that size: a 126px headline, a 188px logo, 26px of border inset. So this
 * renders at that literal size and is **scaled as a whole** by `--poster-scale`, rather than
 * being re-expressed in relative units.
 *
 * That is the difference between a port and a redraw. Proportional units would have to guess
 * a base, and every guess is a place the printed sheet drifts from what was drawn — the
 * headline's `text-shadow: 0 5px 0` is 5 *pixels* of gold-brown offset, and there is no
 * em value for it that survives a change of font size.
 *
 * `transform: scale()` needs a unitless number, so the two scales are constants rather than
 * `calc(210mm / 1240)`:
 *
 * - **Print — 0.64008.** A4 is 210mm; CSS fixes mm at 96dpi, so 210mm = 793.7008px, and
 *   793.7008 / 1240 = 0.6400813. The height follows exactly: 1754 × 0.6400813 = 1122.7px =
 *   297.0mm. Paired with `@page { size: A4; margin: 0 }` in `globals.css`.
 * - **Preview — set by the caller**, so the console can show the whole sheet inside a card.
 *
 * ## What is data and what is the design
 *
 * The design ships placeholders — *"Tho Example Salon"*, *"+975 17 12 34 56"*, *"Mon–Sat,
 * 9:00–19:00"*. All of them are real here: the name and phone come off the `businesses` row,
 * the hours are summarised by `posterHoursLine`, and the tagline follows the shop's own type
 * (`posterTagline`), because *"Hair · Beauty · Care"* is wrong for a barber.
 *
 * The two `<sc-if>` toggles in the source (`showContact`, `showStoreBadges`) become props
 * with the same defaults, and the contact block additionally drops any column it has no fact
 * for — a poster with the word *"Call"* over a blank space is worse than one without a phone
 * number.
 *
 * ## The copy diverges from the design, and deliberately
 *
 * The design drew *"SCAN / TO BOOK"* over *"Book your appointment in seconds"*. Both named a
 * single feature, and the destination is now a hub. `HEADLINE` and `PROMISE` below carry the
 * reasoning; the short version is that a printed code is permanent and its wording has to
 * outlive whatever the salon switches on next.
 */

/**
 * The headline and the promise line.
 *
 * ## The headline is one word now, and that is the point
 *
 * The design drew *"SCAN / TO BOOK"*, and the destination it points at is `/q/<businessId>`
 * — which used to be the walk-in queue and is now a hub: book, browse the shop, or take a
 * place in the line if the salon runs one. So a two-line headline naming **one** of those
 * three would be the thing on the sheet most likely to go stale.
 *
 * That matters more here than it would anywhere else in this app, because **a printed code
 * is permanent**. It is the whole premise: one link per salon, for the life of the salon,
 * stuck to a counter and never reissued. Copy printed beside it has to survive everything
 * the salon does afterwards — starting to sell products, turning the queue on, turning it
 * off again. *"TO BOOK"* survives none of that gracefully; `SCAN` survives all of it.
 *
 * The promise line carries the meaning instead, and is written to be equally durable: it
 * names no feature, so no salon can outgrow it. Both are constants rather than props for
 * the same reason — a poster whose wording varies per salon is a poster that has to be
 * checked per salon.
 */
const HEADLINE = "SCAN";
const PROMISE = "Everything this salon offers";

/**
 * The line under the code, where the encoded URL used to be.
 *
 * **The URL is deliberately not printed.** It was, and it read
 * `bhutansalons.com/q/0b000000-0000-4000-8000-000000000001` — a v4 UUID that wrapped onto two
 * lines and was the least legible thing on the sheet. It also served nobody: the whole point
 * of a QR is that the address is machine-read, and no customer standing in a salon is going to
 * type thirty-six hex characters by hand. A URL nobody can use, taking two lines at 24px, is
 * worse than no URL.
 *
 * What replaces it is the one address a person *can* remember and type. It resolves — checked,
 * not assumed: `www.bhutansalons.com` answers 200 and redirects to the apex — so somebody who
 * cannot scan still has somewhere real to go, and the brand gets its name on the poster.
 *
 * The full target is still announced to screen readers through the `<svg>`'s `aria-label`,
 * which is the one audience that genuinely needs it and cannot scan.
 */
const SITE_LABEL = "www.bhutansalons.com";

export type PosterData = {
  salonName: string;
  tagline: string;
  /** From `qrPath` — the modules and their viewBox, the `<svg>` being the design's own. */
  qr: { path: string; viewBox: string } | null;
  /**
   * The encoded URL, stripped of protocol and trailing slash as the design's script does.
   *
   * **Not printed** — see `SITE_LABEL`. It survives as the `<svg>`'s accessible name, which
   * is the one audience that needs the real target and cannot scan for it.
   */
  qrLabel: string;
  phone: string | null;
  hoursLine: string | null;
  storeLinks: { ios: string; android: string };
};

export function SalonPoster({
  data,
  scale,
  showContact = true,
  showStoreBadges = true,
}: {
  data: PosterData;
  /**
   * Preview scale. The print scale is fixed in CSS and overrides this, so a caller only
   * ever decides how big the poster looks on screen.
   */
  scale: number;
  showContact?: boolean;
  showStoreBadges?: boolean;
}) {
  const { salonName, tagline, qr, qrLabel, phone, hoursLine, storeLinks } = data;

  // Both columns of the contact row are optional, and a lone column should not keep the
  // divider. Computed here so the JSX below stays a straight read of the design.
  const contactItems: { label: string; value: string }[] = [];
  if (phone) contactItems.push({ label: "Call", value: phone });
  if (hoursLine) contactItems.push({ label: "Open", value: hoursLine });
  const drawContact = showContact && contactItems.length > 0;

  return (
    <div
      className="tho-poster-frame"
      style={{ ["--poster-scale" as string]: String(scale) }}
    >
      <div
        className={`tho-poster ${posterFontClass}`}
        style={{
          width: 1240,
          height: 1754,
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(120% 80% at 50% 0%, #C0141F 0%, #A50E17 42%, #7C0810 100%)",
          fontFamily: "var(--font-poster-body), Manrope, system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxSizing: "border-box",
          padding: "74px 92px 66px",
        }}
      >
        {/* The three fixed layers: a dotted gold texture and two inset rules. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.16,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,225,170,0.9) 1.6px, transparent 1.7px)",
            backgroundSize: "34px 34px",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 26,
            border: "2px solid rgba(242,206,107,0.42)",
            borderRadius: 10,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 36,
            border: "1px solid rgba(242,206,107,0.22)",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        />

        {/* ---------------------------------------------------------- identity -- */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              width: 188,
              height: 188,
              borderRadius: 26,
              overflow: "hidden",
              border: "3px solid rgba(242,206,107,0.72)",
              boxShadow: "0 18px 44px rgba(40,3,6,0.45)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a plain img on purpose:
                this sits inside a `transform: scale()` canvas, so the layout size next/image
                would build a srcset from is not the size that reaches the paper. A 512px
                source downscaled by the browser is crisp at every print scale; a 2x srcset
                picked against a print DPR of 1 would not be. */}
            <img
              src="/tho-poster-logo.webp"
              alt=""
              width={512}
              height={512}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: "0.14em",
                color: "#FFE9BC",
                textTransform: "uppercase",
                textAlign: "center",
                // The design's placeholder is 17 characters; a real salon name can be
                // longer, and this is the one string on the sheet that cannot be trimmed.
                maxWidth: 1000,
                lineHeight: 1.1,
              }}
            >
              {salonName}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{ width: 54, height: 2, background: "rgba(242,206,107,0.55)" }}
              />
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "0.3em",
                  color: "rgba(255,233,188,0.78)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {tagline}
              </div>
              <div
                style={{ width: 54, height: 2, background: "rgba(242,206,107,0.55)" }}
              />
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------- headline -- */}
        <div style={{ position: "relative", marginTop: 44, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-poster-display), 'Archivo Black', Manrope, sans-serif",
              fontSize: 176,
              lineHeight: 0.94,
              letterSpacing: "-0.02em",
              color: "#FFD976",
              textShadow: "0 5px 0 #8C5A0B, 0 20px 38px rgba(48,4,7,0.5)",
            }}
          >
            {HEADLINE}
          </div>
        </div>

        {/* ------------------------------------------------------------- promise -- */}
        <div
          style={{
            position: "relative",
            marginTop: 34,
            padding: "18px 46px",
            borderRadius: 999,
            background: "linear-gradient(180deg, #FFDD92 0%, #E8B84B 100%)",
            boxShadow: "inset 0 -3px 0 rgba(140,90,11,0.35)",
          }}
        >
          <div
            style={{
              fontSize: 27,
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: "#8A0B12",
              textTransform: "uppercase",
            }}
          >
            {PROMISE}
          </div>
        </div>

        {/* ------------------------------------------------------------------ qr -- */}
        <div
          style={{
            position: "relative",
            marginTop: 36,
            width: 574,
            padding: "26px 26px 22px",
            borderRadius: 32,
            background: "#FFFDF6",
            border: "8px solid #E8B84B",
            boxShadow: "0 26px 60px rgba(40,3,6,0.42)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {qr ? (
            <svg
              viewBox={qr.viewBox}
              width={420}
              height={420}
              shapeRendering="crispEdges"
              style={{ display: "block" }}
              role="img"
              aria-label={`QR code linking to ${qrLabel}`}
            >
              <path d={qr.path} fill="#14100E" />
            </svg>
          ) : (
            // The encoder failed. The card keeps its footprint so the sheet does not
            // reflow into something that looks deliberate, and the URL below still works.
            <div
              style={{
                width: 420,
                height: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                fontSize: 22,
                fontWeight: 600,
                color: "#A50E17",
                padding: 24,
                boxSizing: "border-box",
              }}
            >
              Couldn&apos;t draw the code — the address below still works.
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: "#A50E17",
                textTransform: "uppercase",
              }}
            >
              Point your camera here
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: "#4A4038",
                textAlign: "center",
                lineHeight: 1.25,
              }}
            >
              {SITE_LABEL}
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------- contact -- */}
        {drawContact ? (
          <div
            style={{
              position: "relative",
              marginTop: 34,
              display: "flex",
              alignItems: "center",
              gap: 36,
            }}
          >
            {contactItems.map((item, i) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 36 }}>
                {i > 0 ? (
                  <div
                    style={{ width: 2, height: 52, background: "rgba(242,206,107,0.4)" }}
                  />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.24em",
                      color: "rgba(255,233,188,0.7)",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: "#FFE9BC" }}>
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* --------------------------------------------------------------- stores -- */}
        {showStoreBadges ? (
          <div
            style={{
              position: "relative",
              marginTop: 38,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "rgba(255,233,188,0.82)",
                textTransform: "uppercase",
              }}
            >
              Tho.bt — also available on
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              <StoreBadge kind="ios" href={storeLinks.ios} />
              <StoreBadge kind="android" href={storeLinks.android} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The two store badges, drawn rather than imported as artwork.
 *
 * Apple and Google both publish official badge images with their own usage rules, and the
 * design chose to draw them — a black pill with the platform glyph and two lines of text.
 * That is what is ported. The marks themselves are the design's own paths.
 *
 * They are `<a>` elements so the on-screen preview is usable; on paper an anchor prints as
 * its text, which is what the badge already says.
 */
function StoreBadge({ kind, href }: { kind: "ios" | "android"; href: string }) {
  const ios = kind === "ios";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 26px",
        borderRadius: 14,
        background: "#000",
        border: "1.5px solid rgba(255,255,255,0.55)",
        minWidth: 268,
        boxSizing: "border-box",
        textDecoration: "none",
      }}
    >
      {ios ? (
        <svg width={38} height={46} viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
      ) : (
        <svg width={40} height={44} viewBox="0 0 24 24" aria-hidden>
          <path
            d="M1.06.481A2.028 2.028 0 0 0 .5 1.086v21.828c0 .258.199.539.53.694l11.532-11.505L1.06.481z"
            fill="#00A0FF"
          />
          <path d="M4.478.834l12.554 7.06-3.53 3.506L4.478.834z" fill="#00E377" />
          <path
            d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202c1.302.826 1.302 1.768 0 2.594z"
            fill="#FFCE00"
          />
          <path d="M13.502 12.6l3.53 3.507-12.554 7.06 9.024-10.567z" fill="#FF3A44" />
        </svg>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: ios ? "0.02em" : "0.06em",
            color: "#fff",
            textTransform: ios ? "none" : "uppercase",
          }}
        >
          {ios ? "Download on the" : "Get it on"}
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "#fff",
            lineHeight: 1.06,
          }}
        >
          {ios ? "App Store" : "Google Play"}
        </div>
      </div>
    </a>
  );
}
