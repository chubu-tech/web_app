"use client";

import { useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** False while server-rendering and during hydration, true on the client. */
const noop = () => () => {};
const useIsHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * Reveals its children from behind a rising panel — the photograph appears the
 * way a curtain lifts, rather than fading in. Pairs with the arch frames so the
 * cards feel like windows being opened.
 */
export function Curtain({
  children,
  className,
  color = "bg-canvas",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Should match the surrounding surface so the panel is invisible at rest. */
  color?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  // The panel is client-only, never server-rendered: if it shipped in the HTML
  // and JS never ran, it would sit over the photograph forever. This section is
  // below the fold, so hydration is long done before it is seen.
  const hydrated = useIsHydrated();

  return (
    <div className={cn("relative", className)}>
      {children}
      {hydrated && !reduced && (
        <motion.span
          className={cn(
            "pointer-events-none absolute inset-0 z-20 origin-bottom",
            color,
          )}
          initial={{ scaleY: 1 }}
          whileInView={{ scaleY: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 1.05, delay, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden
        />
      )}
    </div>
  );
}
