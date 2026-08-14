"use client";

import Image from "next/image";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/marketing/utils";

/**
 * A rounded photographic slab whose image drifts slower than the page and
 * un-zooms as it scrolls through the viewport. Every large photo on the page
 * uses this so the imagery feels physically layered behind the type.
 */
export function ParallaxImage({
  src,
  alt,
  className,
  imageClassName,
  /** How far the image travels, in % of its own height. */
  strength = 12,
  /** Extra scale so the drift never exposes an edge. */
  zoom = 1.18,
  priority = false,
  sizes = "100vw",
  children,
  // `--radius-lg`, 20px. The reference clips photo plates at 14-20px; `rounded-slab`
  // (2rem) belongs to the customer shell's editorial layer, which the public pages
  // no longer render in.
  rounded = "rounded-lg",
}: {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  strength?: number;
  zoom?: number;
  priority?: boolean;
  sizes?: string;
  children?: React.ReactNode;
  rounded?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const raw = useTransform(
    scrollYProgress,
    [0, 1],
    [`-${strength}%`, `${strength}%`],
  );
  const y = useSpring(raw, { stiffness: 90, damping: 26, mass: 0.35 });

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", rounded, className)}
    >
      <motion.div
        className="absolute inset-0"
        style={
          reduced
            ? undefined
            : { y, scale: zoom, transformOrigin: "center center" }
        }
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn("object-cover", imageClassName)}
        />
      </motion.div>
      {children}
    </div>
  );
}

/**
 * Hover-zoom photo used in the grid cards: the image scales up under a fixed
 * rounded mask, matching the reference's card interaction.
 */
export function HoverZoomImage({
  src,
  alt,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn(
        "object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]",
        className,
      )}
    />
  );
}
