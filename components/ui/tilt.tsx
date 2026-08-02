"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Pointer-follow tilt. The card leans a few degrees toward the cursor and
 * settles back on leave — enough parallax to feel physical, not enough to make
 * the photograph hard to read. No-ops under reduced motion and on touch.
 */
export function Tilt({
  children,
  className,
  strength = 8,
}: {
  children: React.ReactNode;
  className?: string;
  /** Maximum lean in degrees. */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const rotateX = useSpring(useMotionValue(0), {
    stiffness: 140,
    damping: 18,
  });
  const rotateY = useSpring(useMotionValue(0), {
    stiffness: 140,
    damping: 18,
  });

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    // Coarse pointers (touch) get no tilt: there is no hover to leave.
    if (reduced || event.pointerType !== "mouse" || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    rotateY.set(px * strength * 2);
    rotateX.set(-py * strength * 2);
  }

  function reset() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={
        reduced
          ? undefined
          : { rotateX, rotateY, transformPerspective: 1100 }
      }
      className={cn("will-change-transform", className)}
    >
      {children}
    </motion.div>
  );
}
