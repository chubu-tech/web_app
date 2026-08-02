"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RevealLines } from "@/lib/heading";
import { cn } from "@/lib/utils";

/**
 * Word-by-word clip-mask rise — the signature headline animation of the
 * reference design. Each word sits in an `overflow-hidden` box and slides up
 * from behind the mask, staggered left-to-right.
 *
 * Accent words render in the editorial serif italic. Mark them either
 * per-word (`{ text: "chair.", accent: true }`) or by listing exact strings in
 * `accents`.
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
              <span
                key={`${lineIndex}-${wordIndex}`}
                // The mask. The pb/-mb pair gives descenders room to sit
                // outside the clip so "g" and "y" are not sheared off.
                className="-mb-[0.14em] inline-flex overflow-hidden pb-[0.14em] align-bottom"
              >
                <motion.span
                  className={cn(
                    "inline-block will-change-transform",
                    wordClassName,
                    isAccent &&
                      cn("font-serif font-normal italic", accentClassName),
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
                {/* The word gap lives outside the mask so it never animates. */}
                <span className="inline-block">&nbsp;</span>
              </span>
            );
          })}
        </span>
      ))}
    </MotionTag>
  );
}
