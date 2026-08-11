"use client";

import Image from "next/image";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import { brand, hero } from "@/lib/marketing/content";
import { CountUp } from "./ui/count-up";
import { Container } from "./ui/section";
import { StoreBadges } from "./ui/store-badges";
import { TextileRule } from "./ui/bhutan";
import { TextReveal } from "./ui/text-reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The page's one job above the fold: say what this is, show it working, and
 * offer the download. Everything below the hero elaborates.
 */
export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // The photograph drifts as you scroll off — the layered depth cue.
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const accents: readonly string[] = hero.accents;
  const headlineLines = hero.titleLines.map((line) =>
    line.map((word) =>
      accents.includes(word) ? { text: word, accent: true } : word,
    ),
  );

  return (
    <div id="top" ref={ref} className="relative pt-24 sm:pt-28">
      <Container>
        <motion.div
          className="rounded-slab-lg grain relative isolate overflow-hidden"
          initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          <div className="relative min-h-[34rem] w-full sm:min-h-[38rem] lg:min-h-[44rem]">
            <motion.div
              className="absolute inset-0"
              style={reduced ? undefined : { y: imageY, scale: imageScale }}
              initial={{ scale: reduced ? 1 : 1.2 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.8, ease: EASE }}
            >
              <Image
                src={hero.image}
                alt={hero.imageAlt}
                fill
                priority
                fetchPriority="high"
                sizes="100vw"
                /*
                  The LCP element, and it was the heaviest thing on the page: measured at
                  **230 KB** cold, against 613 KB of subresources in total, with an LCP of
                  2268 ms.

                  68 rather than the default 75, and this is the one image on the site where
                  that is clearly safe: two full-bleed black gradient scrims are composited
                  over it immediately below, at 85%/45%/10% and 70%/0%/40%, precisely so the
                  headline stays legible. Fine detail in the photograph is already being
                  crushed by those layers before anyone sees it, so paying full quality for
                  detail the design deliberately hides is the wrong trade on the element that
                  decides this page's LCP.
                */
                quality={68}
                className="object-cover object-center"
              />
            </motion.div>

            {/* Legibility scrim in two passes — the right half of the photo
                stays vivid instead of being flattened by one grey layer. */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/10"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40"
              aria-hidden
            />

            <motion.div
              className="relative flex min-h-[34rem] flex-col justify-between p-6 sm:min-h-[38rem] sm:p-9 lg:min-h-[44rem] lg:p-12"
              style={reduced ? undefined : { y: copyY, opacity: copyOpacity }}
            >
              {/* Dzongkha greeting + coverage. */}
              <motion.div
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
                className="flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                {/* Was `font-serif italic` — Instrument Serif, now deleted, so the
                    class would have resolved to Tailwind's default Georgia stack. The
                    greeting sits at medium weight against the uppercase coverage line
                    beside it, which is contrast enough without a second family.

                    It was saffron until the brand colour was unified: every coloured
                    word on the page now takes rausch, the same fill the Sign in button
                    carries. */}
                <span className="text-rausch text-heading font-medium">
                  {brand.greeting}
                </span>
                <TextileRule draw className="w-24" />
                <span className="text-caption-sm font-semibold tracking-[0.16em] text-white/70 uppercase">
                  {hero.eyebrow}
                </span>
              </motion.div>

              <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-7">
                  <TextReveal
                    as="h1"
                    lines={headlineLines}
                    delay={0.3}
                    stagger={0.07}
                    // Weight and leading come from the token now. This used to be
                    // `font-display font-black leading-[0.94] tracking-[-0.03em]` —
                    // a second family at 900 with its own hand-set metrics. One
                    // family at 700 carries the line, and `--text-display-2xl`
                    // already sets 1.02 leading and -0.035em tracking.
                    className="text-display-2xl font-bold text-white"
                    // Rausch. This was once the *only* decorative use of the action
                    // colour, on the grounds that it sits on a photograph with no
                    // control near it and so cannot be read as pressable. That is no
                    // longer the distinction it was — the greeting above and the
                    // download band now take rausch too — but it still holds here.
                    // The accent's own weight drop comes from `TextReveal`.
                    accentClassName="text-rausch"
                  />

                  {/* The product's purpose — the one sentence that has to land. */}
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.85, ease: EASE }}
                    className="mt-6 max-w-xl text-body-lg leading-relaxed text-white/85"
                  >
                    {hero.purpose}
                  </motion.p>

                  {/* Who pays — answered before anyone can wonder. */}
                  <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.95, ease: EASE }}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-2 text-caption font-medium text-white ring-1 ring-white/25 ring-inset backdrop-blur-md"
                  >
                    <BadgeCheck className="text-saffron size-4" aria-hidden />
                    {hero.freeNote}
                  </motion.p>

                  {/* Download next — it is the primary action on this page. */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 1.05, ease: EASE }}
                    className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4"
                  >
                    <StoreBadges tone="light" />
                    <a
                      href={hero.ownerCta.href}
                      className="group inline-flex items-center gap-2 text-ui font-medium text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
                    >
                      {hero.ownerCta.label}
                      <ArrowRight
                        className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden
                      />
                    </a>
                  </motion.div>
                </div>

                <div className="lg:col-span-5 lg:justify-self-end">
                  <QueueCard />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </Container>
    </div>
  );
}

/** Glass card mirroring the app's live queue state — the product, working. */
function QueueCard() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1, delay: 1.15, ease: EASE }}
      className="w-full max-w-sm"
    >
      <motion.div
        className="rounded-slab bg-black/35 p-5 ring-1 ring-white/20 ring-inset backdrop-blur-xl"
        animate={reduced ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-caption-sm font-semibold tracking-[0.16em] text-white/60 uppercase">
            {hero.liveCard.label}
          </span>
          <span className="bg-rausch inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption-sm font-semibold text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
        </div>

        <p className="mt-4 flex items-center gap-2 text-subheading font-semibold text-white">
          {hero.liveCard.salon}
          <Star className="text-saffron size-4 fill-current" aria-hidden />
        </p>

        {/* Both figures tick down on load — the queue visibly moving is the
            single clearest demonstration of what the app does. */}
        <div className="mt-5 flex items-end gap-6">
          <div>
            <span className="block text-[3.25rem] leading-none font-semibold text-white">
              <CountUp
                prefix="#"
                from={hero.liveCard.position + 4}
                value={hero.liveCard.position}
                duration={2.2}
                delay={1.5}
              />
            </span>
            <span className="text-caption text-white/65">in line</span>
          </div>
          <div className="border-l border-white/20 pl-6">
            <span className="block text-[1.5rem] leading-none font-semibold text-white">
              <CountUp
                prefix="~"
                from={hero.liveCard.waitMinutes + 22}
                value={hero.liveCard.waitMinutes}
                duration={2.2}
                delay={1.5}
              />
              <span className="text-ui font-medium"> min</span>
            </span>
            <span className="text-caption text-white/65">
              estimated wait
            </span>
          </div>
        </div>

        {/* Progress track — chairs ahead of you, filling as the line moves. */}
        <div className="mt-5 flex gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20"
            >
              <motion.span
                className="bg-rausch block h-full w-full origin-left rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: i < 2 ? 1 : 0 }}
                transition={{ duration: 0.7, delay: 1.5 + i * 0.12, ease: EASE }}
              />
            </span>
          ))}
        </div>
        <p className="mt-3 text-caption text-white/70">
          We&apos;ll ping you two turns before your chair is free.
        </p>
      </motion.div>
    </motion.div>
  );
}
