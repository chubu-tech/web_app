"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ink" | "ghost" | "light";

const VARIANTS: Record<Variant, string> = {
  // Brand voltage — reserved for the single primary action in a band.
  primary: "bg-rausch text-white hover:bg-rausch-active",
  ink: "bg-ink text-white hover:bg-obsidian",
  ghost:
    "bg-transparent text-ink ring-1 ring-inset ring-ink/15 hover:ring-ink/40 hover:bg-ink/[0.03]",
  light:
    "bg-white/12 text-white ring-1 ring-inset ring-white/25 backdrop-blur-md hover:bg-white/20",
};

/**
 * Pill CTA. It is magnetic: the button leans a few pixels toward the cursor and
 * springs back on leave, and the arrow lifts diagonally — the small repeated
 * interaction that makes every call to action feel handled.
 */
export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  arrow = true,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: "md" | "lg";
  arrow?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const spring = { stiffness: 260, damping: 18, mass: 0.4 };
  const x = useSpring(useMotionValue(0), spring);
  const y = useSpring(useMotionValue(0), spring);

  function pull(event: React.PointerEvent<HTMLAnchorElement>) {
    if (reduced || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    // Cap the travel so the pill never detaches from its layout slot.
    x.set(((event.clientX - (box.left + box.width / 2)) / box.width) * 14);
    y.set(((event.clientY - (box.top + box.height / 2)) / box.height) * 10);
  }

  function release() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.a
      href={href}
      onPointerMove={pull}
      onPointerLeave={release}
      style={reduced ? undefined : { x, y }}
      className={cn(
        "group/btn inline-flex shrink-0 items-center gap-2 rounded-full font-medium",
        "transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        size === "lg"
          ? "h-14 px-7 text-[1.0625rem]"
          : "h-12 px-6 text-[0.9375rem]",
        VARIANTS[variant],
        className,
      )}
    >
      <span>{children}</span>
      {arrow && (
        <ArrowUpRight
          className={cn(
            "size-[1.15em] shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5",
          )}
          strokeWidth={2}
          aria-hidden
        />
      )}
    </motion.a>
  );
}
