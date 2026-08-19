"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Star } from "lucide-react";
import { brand, hero } from "@/lib/marketing/content";
import { CountUp } from "./ui/count-up";
import { Container } from "./ui/section";
import { StoreBadges } from "./ui/store-badges";
import { TextileRule } from "./ui/bhutan";
import { TextReveal } from "./ui/text-reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The page's one job above the fold: say what this is, show it working, and offer
 * the download.
 *
 * ## Why this is two columns and not a photograph with type on it
 *
 * It was a full-bleed photographic slab with the headline, the lede, a chip, both
 * store badges and a glass queue card composited over it under **two** stacked black
 * gradients — 85%/45%/10% across and 70%/0%/40% down — which existed solely to keep
 * white text legible on a photograph the design was otherwise trying to show. That
 * is a fight the layout cannot win at every width: at 390px the same slab had to
 * hold a 40px headline, a three-line lede, a pill and two badges inside a 34rem-tall
 * box, and the scrims had to be dark enough for the worst case, which is what
 * flattened the photograph everywhere else.
 *
 * The reference resolves this by not doing it: type sits on the white canvas, and
 * photography sits beside it doing the work type is not asked to do. So the copy is
 * ink on canvas at full contrast with no scrim at all, the photograph keeps its own
 * exposure, and the only white-on-image element left is the live card — which is now
 * a **white** card, the reference's own idiom, rather than dark glass.
 *
 * It also fixes the responsive problem outright: at 390px the two columns are simply
 * stacked, and nothing overlaps anything.
 */
export function Hero() {
  const reduced = useReducedMotion();

  const accents: readonly string[] = hero.accents;
  const headlineLines = hero.titleLines.map((line) =>
    line.map((word) =>
      accents.includes(word) ? { text: word, accent: true } : word,
    ),
  );

  return (
    <div
      id="top"
      className="pt-[calc(var(--site-header-height)+2rem)] pb-14 sm:pt-[calc(var(--site-header-height)+3rem)] sm:pb-16 lg:pb-20"
    >
      <Container>
        {/*
          `items-stretch` (the default), **not** `items-center`. With a fixed aspect
          ratio on the photo the two columns are different heights, and centring
          them left ~150px of blank canvas above and below the copy at 1280 — the
          "awkward empty space" version of a two-column hero. Stretched, the row
          height is set by the copy and the photo fills it exactly, so the band has
          one top edge and one bottom edge.
        */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* ── Copy ──────────────────────────────────────────────────── */}
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, y: reduced ? 0 : -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              {/* The Dzongkha greeting, in the brand accent. This and the kira rule
                  beside it are the whole of the page's Bhutanese identity above the
                  fold — deliberately small, because the reference's restraint is the
                  point and identity does not need to be loud to be present. */}
              <span className="text-rausch text-title font-semibold">
                {brand.greeting}
              </span>
              <TextileRule draw className="w-20" />
              <span className="text-muted text-caption-sm font-semibold tracking-[0.14em] uppercase">
                {hero.eyebrow}
              </span>
            </motion.div>

            <TextReveal
              as="h1"
              lines={headlineLines}
              delay={0.15}
              stagger={0.06}
              // 600, not the 900 this used to carry. The token already sets 1.08
              // leading and -0.026em tracking, so nothing is hand-set here.
              //
              // `font-display` is Fraunces — the page's one display voice, and the
              // reason a 54px headline reads as a different *kind* of thing rather
              // than a large paragraph. It is safe beside `font-semibold` because
              // the two land in different `twMerge` groups (family vs weight); do
              // not add a second `text-*` here, which is the collision that once ate
              // a label's colour (see `lib/utils.ts`).
              className="text-display-2xl font-display text-ink mt-6 font-semibold"
              accentClassName="text-rausch"
            />

            {/* The product's purpose — the one sentence that has to land. */}
            <motion.p
              initial={{ opacity: 0, y: reduced ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
              /* 34rem written out, not `max-w-lg`. `globals.css` declares
                 `--spacing-lg: 24px` and a named width resolves against the spacing
                 namespace before `--container-*`, so `max-w-lg` compiles to
                 `max-width: 24px`. See `components/ui/sheet.tsx`. */
              className="text-body text-body-lg mt-5 max-w-[34rem]"
            >
              {hero.purpose}
            </motion.p>

            {/* Download next — it is the primary action on this page. */}
            <motion.div
              initial={{ opacity: 0, y: reduced ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
              className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4"
            >
              <StoreBadges />
              <a
                href={hero.ownerCta.href}
                className="text-ink group text-title inline-flex items-center gap-1.5 font-medium underline decoration-hairline decoration-2 underline-offset-4 transition-colors hover:decoration-ink"
              >
                {hero.ownerCta.label}
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </a>
            </motion.div>
          </div>

          {/* ── Photograph, with the product working on top of it ─────── */}
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
            className="relative lg:col-span-6"
          >
            {/*
              Three shapes, and each one is decided by what has to fit inside it.

              Portrait on a phone: the live card is pinned to the foot of this box,
              and at 4:3 it covered three-quarters of a 262px-tall photo. 4:5 leaves
              the photograph visible above it.

              Landscape from `sm`, where the card shrinks to a fixed 19rem in the
              corner and the extra width is better spent on the picture.

              From `lg` the ratio is dropped entirely for `h-full`: the column is
              stretched to the copy's height, so the photo matches it instead of
              dictating it. `min-h` is the floor for a viewport where the copy
              happens to be short.
            */}
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[28rem]">
              <motion.div
                className="absolute inset-0"
                initial={{ scale: reduced ? 1 : 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.4, ease: EASE }}
              >
                <Image
                  src={hero.image}
                  alt={hero.imageAlt}
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  /*
                    Still 68 rather than the default 75, and still listed in
                    `next.config.ts`'s `images.qualities` — an unlisted value is
                    silently coerced to the nearest allowed one, so a `quality` prop
                    that is not in that array is dead code that looks live.

                    The reason changed, though. It used to be "two black scrims crush
                    the detail before anyone sees it"; those scrims are gone. What
                    justifies it now is simply that this is the LCP element on a page
                    served to phones on Bhutanese mobile data, and at this size the
                    difference between 68 and 75 is not visible while the byte
                    difference is.
                  */
                  quality={68}
                  className="object-cover object-center"
                />
              </motion.div>

              {/* A short scrim at the foot only — enough to seat the card, nowhere
                  near enough to flatten the photograph. */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent"
                aria-hidden
              />

              <QueueCard />
            </div>
          </motion.div>
        </div>
      </Container>
    </div>
  );
}

/**
 * The live queue, as a card floating on the photograph.
 *
 * **White, not dark glass.** The reference floats white cards over photography and
 * caps elevation at a single shadow tier; a `bg-black/35 backdrop-blur-xl` panel is
 * a different design language, and on a light photograph it read as a smudge. White
 * also means the figures are ink on white at full contrast rather than white on an
 * unknown average of whatever is behind them.
 *
 * It sits **inside** the photo's bounds at every width — `inset` rather than a
 * negative offset — so there is no breakpoint at which it hangs off the grid and
 * widens the document.
 */
function QueueCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
      className="bg-paper shadow-card absolute right-4 bottom-4 left-4 rounded-md p-4 sm:right-auto sm:bottom-5 sm:left-5 sm:w-[19rem]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted text-caption-sm font-semibold tracking-[0.14em] uppercase">
          {hero.liveCard.label}
        </span>
        <span className="bg-rausch-cta inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-badge font-semibold tracking-[0.08em] text-white uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>
      </div>

      <p className="text-ink text-subheading mt-3 flex items-center gap-1.5 font-semibold">
        <span className="truncate">{hero.liveCard.salon}</span>
        <Star className="text-star size-4 shrink-0 fill-current" aria-hidden />
      </p>

      {/* Both figures tick down on load — the queue visibly moving is the single
          clearest demonstration of what the app does. */}
      <div className="mt-4 flex items-end gap-5">
        <div>
          <span className="text-ink block text-[2.5rem] leading-none font-semibold tracking-tight">
            <CountUp
              prefix="#"
              from={hero.liveCard.position + 4}
              value={hero.liveCard.position}
              duration={2.2}
              delay={1.3}
            />
          </span>
          <span className="text-muted block text-caption">in line</span>
        </div>
        <div className="border-hairline-soft border-l pl-5">
          <span className="text-ink block text-[1.375rem] leading-none font-semibold tracking-tight">
            <CountUp
              prefix="~"
              from={hero.liveCard.waitMinutes + 22}
              value={hero.liveCard.waitMinutes}
              duration={2.2}
              delay={1.3}
            />
            <span className="text-title font-medium"> min</span>
          </span>
          <span className="text-muted block text-caption">estimated wait</span>
        </div>
      </div>

      {/* Progress track — chairs ahead of you, filling as the line moves. */}
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="bg-surface-strong h-1.5 flex-1 overflow-hidden rounded-full"
          >
            <motion.span
              className="bg-rausch block h-full w-full origin-left rounded-full"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i < 2 ? 1 : 0 }}
              transition={{ duration: 0.6, delay: 1.3 + i * 0.1, ease: EASE }}
            />
          </span>
        ))}
      </div>
      <p className="text-muted mt-3 text-caption">
        We’ll ping you two turns before your chair is free.
      </p>
    </motion.div>
  );
}
