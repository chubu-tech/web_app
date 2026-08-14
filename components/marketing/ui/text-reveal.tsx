"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { RevealLines } from "@/lib/marketing/heading";
import { cn } from "@/lib/marketing/utils";

/**
 * Word-by-word clip-mask rise — the signature headline animation of the
 * reference design. Each word sits in an `overflow-hidden` box and slides up
 * from behind the mask, staggered left-to-right.
 *
 * Accent words are set apart by **weight, not by a second family.** Mark them either
 * per-word (`{ text: "chair.", accent: true }`) or by listing exact strings in
 * `accents`.
 *
 * They used to render `font-serif font-normal italic` — Instrument Serif, the one
 * decorative face on the site. Dropping it left `font-serif` resolving to Tailwind's
 * default `ui-serif, Georgia` stack, which is why the class had to go rather than just
 * the font: a stale `font-serif` here would have quietly set Georgia.
 *
 * What replaces it is the contrast the heading already has available: the line is 600
 * or 700, so an accent word at 400 reads as emphasis on its own, and a touch of
 * positive tracking keeps the lighter weight from looking merely thinner. One family,
 * hierarchy from weight — which is the point of the whole exercise.
 *
 * ## The word gap is a real space, between the masks — and that is a wrapping fix
 *
 * It used to be an `&nbsp;` in a span *inside* each mask, which left the parent line
 * box with **no break opportunity anywhere**: adjacent inline-flex boxes with no
 * whitespace between them cannot be broken apart, so a heading could only ever be as
 * many lines as `parseHeading`'s explicit `|` gave it. Every heading was one
 * unbreakable line that overflowed its container rather than wrapping, which is
 * invisible until the viewport is narrow enough for a real one to do it: at 320px
 * "Watch the line move, live" measured 328px in a 280px column and pushed the **whole
 * page** 28px wide, so every section on the site scrolled sideways.
 *
 * A plain space between the masks gives the line somewhere to break and renders the
 * same gap. It changes nothing where a heading already fits — a line that fits on one
 * line still does, break opportunities or not — so this only ever un-breaks the
 * headings that were broken.
 */
export function TextReveal({
  lines,
  accents = [],
  className,
  wordClassName,
  accentClassName,
  delay = 0,
  stagger = 0.055,
  as = "h2",
  once = true,
  id,
}: {
  lines: RevealLines;
  accents?: readonly string[];
  className?: string;
  wordClassName?: string;
  accentClassName?: string;
  delay?: number;
  stagger?: number;
  as?: "h1" | "h2" | "h3" | "p" | "div";
  once?: boolean;
  /** Set so a `<section aria-labelledby>` can point at this heading. */
  id?: string;
}) {
  const reduced = useReducedMotion();
  const MotionTag = motion[as];

  return (
    <MotionTag
      id={id}
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once, amount: 0.35 }}
      variants={{
        hidden: {},
        shown: {
          transition: {
            staggerChildren: reduced ? 0 : stagger,
            delayChildren: reduced ? 0 : delay,
          },
        },
      }}
    >
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block">
          {line.map((word, wordIndex) => {
            const text = typeof word === "string" ? word : word.text;
            const isAccent =
              typeof word === "string"
                ? accents.includes(word)
                : (word.accent ?? false);

            return (
              <Fragment key={`${lineIndex}-${wordIndex}`}>
                <span
                  // The mask. The pb/-mb pair gives descenders room to sit
                  // outside the clip so "g" and "y" are not sheared off.
                  className="-mb-[0.14em] inline-flex overflow-hidden pb-[0.14em] align-bottom"
                >
                  <motion.span
                    className={cn(
                      "inline-block will-change-transform",
                      wordClassName,
                      isAccent &&
                        cn("font-normal tracking-[-0.01em]", accentClassName),
                    )}
                    variants={{
                      hidden: {
                        y: reduced ? 0 : "115%",
                        opacity: reduced ? 0 : 1,
                      },
                      shown: {
                        y: 0,
                        opacity: 1,
                        transition: {
                          duration: reduced ? 0 : 0.95,
                          ease: [0.16, 1, 0.3, 1],
                        },
                      },
                    }}
                  >
                    {text}
                  </motion.span>
                </span>{" "}
              </Fragment>
            );
          })}
        </span>
      ))}
    </MotionTag>
  );
}
