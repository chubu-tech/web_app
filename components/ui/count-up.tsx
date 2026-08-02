"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/** Counts from 0 to `value` the first time it scrolls into view. */
export function CountUp({
  value,
  from = 0,
  suffix = "",
  prefix = "",
  duration = 1.4,
  delay = 0,
  className,
}: {
  value: number;
  /** Start point — set above `value` to count down (e.g. a shrinking queue). */
  from?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(from);

  useEffect(() => {
    // Reduced motion renders the final value straight from props below.
    if (!inView || reduced) return;

    const controls = animate(from, value, {
      delay,
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, reduced, value, from, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {reduced ? value : display}
      {suffix}
    </span>
  );
}
