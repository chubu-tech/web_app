"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/** Keep a value inside [min, max), wrapping around — a seamless loop. */
function wrap(min: number, max: number, value: number) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

/**
 * Infinite horizontal ticker that reacts to the page.
 *
 * It drifts on its own, but scroll velocity pushes it: scroll down and it runs
 * faster, scroll up and it reverses, and it skews slightly with the shove
 * before settling. The track is rendered twice and wrapped over -50%, so the
 * seam never shows. Falls back to a static row under reduced motion.
 */
export function Marquee({
  children,
  className,
  /** Percent of the track travelled per second at rest. */
  speed = 2.4,
  reverse = false,
  fade = true,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  reverse?: boolean;
  fade?: boolean;
}) {
  const reduced = useReducedMotion();
  const baseX = useMotionValue(0);
  // -1 drifts leftward, the conventional direction for a ticker.
  const direction = useRef(reverse ? 1 : -1);

  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  // Scroll speed becomes a multiplier on the drift, and a slight lean.
  const velocityFactor = useTransform(smoothVelocity, [-1200, 1200], [-4, 4], {
    clamp: false,
  });
  const skew = useTransform(smoothVelocity, [-1500, 1500], [-4, 4], {
    clamp: true,
  });

  useAnimationFrame((_, delta) => {
    if (reduced) return;
    const factor = velocityFactor.get();
    // Scrolling down pushes it along; scrolling up reverses it. Below a small
    // threshold the sign stays put, so a flick never jitters the direction.
    if (factor > 0.4) direction.current = reverse ? 1 : -1;
    else if (factor < -0.4) direction.current = reverse ? -1 : 1;

    const drift = direction.current * speed * (delta / 1000);
    baseX.set(baseX.get() + drift + drift * Math.abs(factor));
  });

  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);

  return (
    <div
      className={cn(
        "group relative flex w-full overflow-hidden",
        fade && "mask-edges",
        className,
      )}
    >
      <motion.div
        className="flex w-max shrink-0 items-center"
        style={reduced ? undefined : { x, skewX: skew }}
      >
        {/* Two identical halves — the -50% wrap lands exactly on the seam. */}
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
