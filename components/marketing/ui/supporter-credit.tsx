"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
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
 * The supporter credit, inline under the hero's store badges.
 *
 * ## What this replaced
 *
 * A full band — `SupportedBy`, between the proof figures and the price list: a label
 * and a sentence in one column, and the lockup on a 30rem `bg-paper` card in the other.
 * It was removed because it worked *too* well. A partner's mark on its own lifted card,
 * given a ninth of the page's vertical rhythm, outweighed the thing the page is selling;
 * the credit is owed and the prominence was not.
 *
 * So the credit moved to where a credit belongs — a line under the download call to
 * action, at the size a byline is set. Same artwork, same animation, a fifth of the
 * footprint. `DabtongCredit` in the footer is unchanged and still carries the name on
 * all six marketing routes.
 *
 * ## Why the wordmark is drawn here and set as text in the footer
 *
 * `DabtongCredit` renders the mark plus the name in type, because at the ~90px the
 * footer mast allows the drawn wordmark is a grey smear. This is 152px rising to 168px
 * from `sm`, which is the width at which it stops being one.
 *
 * Measured off the artwork rather than eyeballed: both wordmark lines span **63.5 units**
 * of `LOCKUP_VIEWBOX`'s 635.911, so a line is `width · 63.5 / 635.911` tall — 15px at
 * 9.5rem and 17px from `sm`, against 9px at the footer's 90px. That is reading size; the
 * footer's is not. **Do not shrink this below about 8.5rem** without switching to the
 * mark-plus-caption treatment, because that is where the tradeoff the footer already
 * made starts applying here too.
 *
 * ## What animates, and why each one is here
 *
 * The band's four gestures, kept whole because they are what makes a small mark worth
 * looking at at all:
 *
 * 1. **The lattice weaves itself, square by square, from the middle out.** Specific to
 *    *this* logo — the mark is a 1·3·5·3·1 diamond of squares, so `WEAVE_CELLS`
 *    staggers by Manhattan ring and 13 shapes arrive in three beats. It is a mask, so
 *    the pixels are the supplied artwork's; see the note on `WEAVE_CELLS`.
 * 2. **The two wordmark lines fade up behind it**, DABTONG then HOUSE, reading order.
 * 3. **One light sweep across the finished lockup.** One-shot, not a loop: the only
 *    infinite animation this project allows itself is `offer-drift`.
 * 4. **Hover replays the sweep** — `sweep` is a counter keyed onto the rect, so each
 *    hover remounts it and it runs again. The one bit of state in the file.
 *
 * ## It animates on mount, not on scroll
 *
 * The band used `useInView`, because it sat two thirds of the way down the page. This
 * sits above the fold on every viewport, so an observer would fire on the first frame
 * anyway and would only add a way for the entrance to be missed. Instead `delay` chains
 * it to the hero's own sequence — the caller passes the beat after the badges land, and
 * everything below is relative to it. That is also why there is no `Reveal` wrapper:
 * `hero.tsx` animates its own children with explicit delays and nothing in it is
 * scroll-triggered.
 *
 * `useReducedMotion` collapses every duration and delay to zero, which lands the whole
 * thing in its finished state on the first frame. That is the same contract `Reveal`
 * honours, and it is why the hidden states below are all `opacity`/`scale` rather than
 * anything that would leave a shape half-drawn.
 *
 * ## The no-JavaScript case is answered in the footer, not here
 *
 * Like every entrance in the hero, the initial state is `opacity: 0`, so with scripting
 * off this line is blank. What makes that acceptable for a credit somebody is owed is
 * that `DabtongCredit` in the footer is a **server** component with no animation on it
 * at all, so the name and the mark render statically on this page and on all five
 * documents. Do not "fix" this by dropping its entrance; fix it by never removing that
 * one.
 */
export function SupporterCredit({
  className,
  /** Seconds to wait before the first square lands. Everything below is relative to it. */
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const [sweep, setSweep] = useState(0);

  /*
    `useId` rather than a literal: SVG `mask` and `linearGradient` are referenced by
    document-wide id, and this component is one `<SupporterCredit />` away from being
    rendered twice on a page. Two `<mask id="weave">` and the second element silently
    takes the first's mask.
  */
  const uid = useId().replace(/:/g, "");
  const weaveId = `dh-weave-${uid}`;
  const inkId = `dh-ink-${uid}`;
  const sheenId = `dh-sheen-${uid}`;

  const t = (at: number, duration: number, ease: Bezier = EASE) => ({
    duration: reduced ? 0 : duration,
    delay: reduced ? 0 : delay + at,
    ease,
  });

  const linked = supporter.href.length > 0;

  const lockup = (
    <svg
      viewBox={LOCKUP_VIEWBOX}
      role="img"
      aria-label={supporter.name}
      // Fixed width rather than a percentage: this is a byline beside a label, not a
      // block that should grow with its column. `h-auto` keeps the 3.88:1 aspect.
      className="text-ink h-auto w-[9.5rem] sm:w-[10.5rem]"
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
              animate={{ scale: 1, opacity: 1 }}
              transition={t(cell.ring * 0.13, 0.62, SETTLE)}
            />
          ))}
        </mask>

        {/*
          The lockup's silhouette, static, used only to clip the sweep so the light
          travels across the letterforms rather than across the canvas behind them.
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
          animate={{ opacity: 1, x: 0 }}
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
            animate={{ x: 700 }}
            transition={{
              duration: 1.15,
              delay: sweep === 0 ? delay + 1.2 : 0,
              ease: EASE,
            }}
          />
        </g>
      )}
    </svg>
  );

  return (
    /*
      No heading, and that is deliberate. In the band "Supported by" was the section's
      `<h2>`, because a `<section>` needs an accessible name. Inside the hero the only
      heading is the `<h1>`, and an `<h2>` reading "Supported by" wedged between it and
      the fold would put a section break in the outline where there is no section. The
      label is a `<span>`; the lockup carries `role="img"` with the partner's name, so
      a screen reader still reads "Supported by — Dabtong House" in order.

      `inline-flex`, so the row is as wide as its contents and the anchor's focus ring
      has nothing to travel across. `items-center` aligns the label to the middle of the
      lockup's box — the mark is the tallest thing in it, so this reads as centred on
      the logo rather than on the wordmark.
    */
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.7,
        delay: reduced ? 0 : delay,
        ease: EASE,
      }}
      onHoverStart={() => setSweep((n) => n + 1)}
      className={cn("inline-flex items-center gap-3", className)}
    >
      <span className="text-muted text-caption-sm font-semibold tracking-[0.14em] uppercase">
        {supporter.label}
      </span>

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
  );
}
