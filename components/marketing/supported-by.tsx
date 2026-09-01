"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { supporter } from "@/lib/marketing/content";
import {
  LOCKUP_VIEWBOX,
  MARK_PATH,
  MARK_TRANSFORM,
  WEAVE_CELL,
  WEAVE_CELLS,
  WORDMARK_DABTONG,
  WORDMARK_HOUSE,
} from "@/lib/marketing/dabtong-logo";
import { cn } from "@/lib/marketing/utils";
import { TextileRule } from "./ui/bhutan";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container } from "./ui/section";

/**
 * A cubic bezier, written out rather than left to inference.
 *
 * `as const` on the two curves below types each as its own literal tuple, which makes
 * the second one unassignable to a parameter defaulting to the first. The alias is the
 * fix and it is also the honest type: these are beziers, not two unrelated quadruples.
 */
type Bezier = [number, number, number, number];

/** The site's motion curve — expo-out, as in `Reveal` and every hero transition. */
const EASE: Bezier = [0.16, 1, 0.3, 1];

/** Slight overshoot, used only where a shape lands. Same curve as `--animate-offer-stamp`. */
const SETTLE: Bezier = [0.34, 1.56, 0.64, 1];

/**
 * The supporter band, between the proof figures and the price list.
 *
 * ## Why it sits there
 *
 * Proof answers *is anybody using this?* with counts off the live salon index. This
 * answers *is anybody behind it?* They are one question asked twice, so they are
 * adjacent — and both come before Pricing, because who backs the thing is context for
 * what it costs rather than an afterthought to it. Putting it any lower would have it
 * competing with the closing call to action, which is the one band on the page that is
 * allowed to shout.
 *
 * ## It renders on `bg-canvas`, deliberately
 *
 * `Proof` is `bg-surface-soft` with a `border-y`. Two tinted bands back to back read as
 * one long tinted band with a stray rule through it, so this one takes the page ground
 * and lets Proof's bottom border do the separating. The lockup gets its own `bg-paper`
 * card, which is the distinction `app/(marketing)/layout.tsx` spells out: canvas is the
 * page, paper is a thing lifted off it.
 *
 * ## There is no eyebrow and no display heading
 *
 * `ui/section.tsx` caps the site at two eyebrows and says to cut one before adding a
 * third. This band does not need the exemption anyway: with a logo doing the work a
 * display heading would do elsewhere, a `SectionHeading` above it would be a label for
 * a label. So the tracked-caps "Supported by" *is* the `<h2>` — the same treatment
 * `LinkRowLabel` gives the footer's rows, minus the accent dot that marks an `Eyebrow`.
 * It carries `id="supporter-title"`, so the section still has a real accessible name.
 *
 * ## What animates, and why each one is here
 *
 * Three entrances and one interaction, all triggered from a single `useInView` on the
 * card rather than from four observers:
 *
 * 1. **The lattice weaves itself, square by square, from the middle out.** This is the
 *    band's one flourish and it is specific to *this* logo — the mark is a 1·3·5·3·1
 *    diamond of squares, so `WEAVE_CELLS` staggers by Manhattan ring and 13 shapes
 *    arrive in three beats. It is a mask, so the pixels are the supplied artwork's; see
 *    the note on `WEAVE_CELLS`.
 * 2. **The two wordmark lines fade up behind it**, DABTONG then HOUSE, reading order.
 *    Plain opacity and travel, no mask — the mark is the thing worth drawing attention
 *    to and two competing reveals would split it.
 * 3. **One light sweep across the finished lockup.** One-shot, not a loop: the only
 *    infinite animation this project allows itself is `offer-drift`, and a logo with a
 *    permanent shine on it is a 2009 web banner.
 * 4. **Hover replays the sweep** — `sweep` is a counter keyed onto the rect, so each
 *    hover remounts it and it runs again. The one bit of state in the file.
 *
 * `useReducedMotion` collapses every duration and delay to zero, which lands the whole
 * thing in its finished state on the first frame. That is the same contract `Reveal`
 * honours, and it is why the hidden states below are all `opacity`/`scale` rather than
 * anything that would leave a shape half-drawn.
 *
 * ## The no-JavaScript case is answered in the footer, not here
 *
 * Like every `Reveal` on this site, the initial state is `opacity: 0`, so with scripting
 * off this band is blank — the same as the eight bands around it. What makes that
 * acceptable for a credit somebody is owed is that `DabtongCredit` in the footer is a
 * **server** component with no animation on it at all, so the name and the mark render
 * statically on this page and on all five documents. Do not "fix" this band by dropping
 * its entrance; fix it by never removing that one.
 */
export function SupportedBy() {
  const reduced = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  const shown = useInView(card, { once: true, amount: 0.4 });
  const [sweep, setSweep] = useState(0);

  /*
    `useId` rather than a literal: SVG `mask` and `linearGradient` are referenced by
    document-wide id, and this component is one `<SupportedBy />` away from being
    rendered twice on a page. Two `<mask id="weave">` and the second element silently
    takes the first's mask.
  */
  const uid = useId().replace(/:/g, "");
  const weaveId = `dh-weave-${uid}`;
  const inkId = `dh-ink-${uid}`;
  const sheenId = `dh-sheen-${uid}`;

  const t = (delay: number, duration: number, ease: Bezier = EASE) => ({
    duration: reduced ? 0 : duration,
    delay: reduced ? 0 : delay,
    ease,
  });

  const linked = supporter.href.length > 0;

  const lockup = (
    <svg
      viewBox={LOCKUP_VIEWBOX}
      role="img"
      aria-label={supporter.name}
      // Full width of its card, capped so the wordmark never outruns a comfortable
      // reading size on a wide desktop. `h-auto` keeps the 3.88:1 aspect.
      className="text-ink h-auto w-full max-w-[30rem]"
    >
      <defs>
        {/*
          The weave. `maskUnits="userSpaceOnUse"` on every mask here rather than the
          `objectBoundingBox` default: the default region is -10%/+120% of the masked
          element's own bbox, which is a different box for each of the two masks below
          and one more thing to reason about when a cell sits flush with an edge.
          Stating the viewBox makes all three regions the same known rectangle.
        */}
        <mask
          id={weaveId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="635.911"
          height="163.736"
        >
          {WEAVE_CELLS.map((cell) => (
            <motion.rect
              key={`${cell.x}-${cell.y}`}
              x={cell.x}
              y={cell.y}
              width={WEAVE_CELL}
              height={WEAVE_CELL}
              fill="#fff"
              // `fill-box` so each square scales about its own centre. Without it the
              // origin is the SVG's, and thirteen squares fly in from one corner.
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={
                shown ? { scale: 1, opacity: 1 } : { scale: 0.2, opacity: 0 }
              }
              transition={t(cell.ring * 0.13, 0.62, SETTLE)}
            />
          ))}
        </mask>

        {/*
          The lockup's silhouette, static, used only to clip the sweep so the light
          travels across the letterforms rather than across the card behind them.
        */}
        <mask
          id={inkId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="635.911"
          height="163.736"
        >
          <path transform={MARK_TRANSFORM} d={MARK_PATH} fill="#fff" />
          <g fill="#fff">
            {[...WORDMARK_DABTONG, ...WORDMARK_HOUSE].map((glyph) => (
              <path key={glyph.t} transform={glyph.t} d={glyph.d} />
            ))}
          </g>
        </mask>

        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* The mark, arriving one square at a time. */}
      <g mask={`url(#${weaveId})`}>
        <path transform={MARK_TRANSFORM} d={MARK_PATH} fill="currentColor" />
      </g>

      {/* The wordmark, one motion group per line so they can be staggered. */}
      {[WORDMARK_DABTONG, WORDMARK_HOUSE].map((line, i) => (
        <motion.g
          key={i}
          fill="currentColor"
          initial={{ opacity: 0, x: -14 }}
          animate={shown ? { opacity: 1, x: 0 } : { opacity: 0, x: -14 }}
          transition={t(0.46 + i * 0.12, 0.75)}
        >
          {line.map((glyph) => (
            <path key={glyph.t} transform={glyph.t} d={glyph.d} />
          ))}
        </motion.g>
      ))}

      {/*
        The sweep. `key={sweep}` is the replay mechanism — a hover bumps the counter,
        React remounts the rect, and it runs its entrance again from the start. Nothing
        else in the file is stateful.

        Skipped entirely under reduced motion rather than given a zero duration: a
        gradient parked mid-travel over the type is worse than no sweep, and unlike the
        two entrances above there is no "finished state" worth landing on.
      */}
      {!reduced && (
        <g mask={`url(#${inkId})`}>
          <motion.rect
            key={sweep}
            y="0"
            width="200"
            height="163.736"
            fill={`url(#${sheenId})`}
            initial={{ x: -240 }}
            animate={shown ? { x: 700 } : { x: -240 }}
            transition={{ duration: 1.15, delay: sweep === 0 ? 1.2 : 0, ease: EASE }}
          />
        </g>
      )}
    </svg>
  );

  return (
    /*
      A bare `<section>` rather than `<Section>`, and the reason is the padding.

      `Section` is 56/64/**80**px, which is the rhythm for a band that argues something.
      This one credits somebody in a single sentence, and at 80px it read as a section
      that had failed to load its content — 160px of cream between the proof figures and
      "Customers never pay", with a logo floating in the middle of it. Measured in the
      browser at 1440, not guessed.

      It cannot be done by passing `py-10` through `className`: `cn` here is a plain join
      with no tailwind-merge, so the two paddings would both be emitted and the winner
      would be whichever utility Tailwind happened to order later. Owning the element is
      the honest version of the same edit. `scroll-mt` is copied from `Section` so an
      anchored jump still clears the header.
    */
    <section
      id="supported-by"
      aria-labelledby="supporter-title"
      className="scroll-mt-[calc(var(--site-header-height)+1.5rem)] py-10 sm:py-12 lg:py-14"
    >
      <Container>
        <RevealGroup className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          {/* ── What it says ───────────────────────────────────────────── */}
          <Reveal asChild className="lg:col-span-5">
            <div>
              <h2
                id="supporter-title"
                className="text-muted text-caption-sm font-semibold tracking-[0.14em] uppercase"
              >
                {supporter.label}
              </h2>

              {/* The kira rule, drawing itself in — the same gesture that opens the
                  hero and anchors the footer's mast. It is what ties a partner's mark
                  back to this site's own voice. */}
              <TextileRule className="mt-5 w-24" draw />

              <p className="text-body text-body-lg mt-5 max-w-[30rem]">
                {supporter.body}
              </p>
            </div>
          </Reveal>

          {/* ── The lockup ─────────────────────────────────────────────── */}
          <Reveal asChild className="lg:col-span-7">
            <div>
              <motion.div
                ref={card}
                onHoverStart={() => setSweep((n) => n + 1)}
                /*
                  A lift on hover, and nothing else moves. `shadow-card` is the single
                  elevation tier this project allows, so the hover cannot add a
                  heavier one — it borrows 2px of travel instead, which reads as the
                  card responding without inventing a second shadow.
                */
                whileHover={reduced ? undefined : { y: -2 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={cn(
                  "border-hairline bg-paper shadow-card rounded-lg",
                  "flex items-center justify-center px-6 py-10 sm:px-12 sm:py-12",
                )}
              >
                {linked ? (
                  <a
                    href={supporter.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-visible:ring-rausch block rounded-sm focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
                  >
                    {lockup}
                  </a>
                ) : (
                  lockup
                )}
              </motion.div>
            </div>
          </Reveal>
        </RevealGroup>
      </Container>
    </section>
  );
}
