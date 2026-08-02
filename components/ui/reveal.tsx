"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

const OFFSET: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 44 },
  down: { y: -44 },
  left: { x: 44 },
  right: { x: -44 },
  none: {},
};

/**
 * Scroll-in reveal: opacity + a short travel on an expo-out curve. This is the
 * workhorse animation of the page — every section band uses it so the whole
 * scroll reads as one continuous motion language.
 *
 * Wrap several `<Reveal>` children in a `<RevealGroup>` to stagger them.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.9,
  className,
  once = true,
  amount = 0.25,
  asChild = false,
}: {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
  amount?: number;
  /** Skip the viewport trigger — inherit it from a parent RevealGroup. */
  asChild?: boolean;
}) {
  const reduced = useReducedMotion();
  const offset = reduced ? {} : OFFSET[direction];

  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    shown: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: reduced ? 0 : duration,
        delay: reduced ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      {...(asChild
        ? {}
        : {
            initial: "hidden",
            whileInView: "shown",
            viewport: { once, amount },
          })}
    >
      {children}
    </motion.div>
  );
}

/** Parent that triggers once and staggers its `<Reveal asChild>` children. */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
  delay = 0,
  amount = 0.2,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  amount?: number;
  once?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once, amount }}
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
      {children}
    </motion.div>
  );
}
