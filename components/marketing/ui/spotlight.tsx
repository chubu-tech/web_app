"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/marketing/utils";

/**
 * Wraps a dark band with a soft warm light that follows the cursor.
 *
 * It has to be a wrapper rather than a sibling overlay: the glow must paint
 * *behind* the content (or it tints the text), but the pointer listener must
 * still see moves over that content — so the listener goes on the parent and
 * events reach it by bubbling.
 *
 * Atmosphere only: nothing renders for reduced-motion visitors, and the glow is
 * desktop-only since there is no cursor to follow on a phone.
 */
export function Spotlight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [pos, setPos] = useState({ x: 50, y: 40 });
  const [visible, setVisible] = useState(false);
  const frame = useRef<number | null>(null);

  if (reduced) return <>{children}</>;

  return (
    <div
      className={cn("relative", className)}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        // One update per painted frame — pointermove fires far more often.
        if (frame.current !== null) return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * 100;
        const y = ((event.clientY - box.top) / box.height) * 100;
        frame.current = requestAnimationFrame(() => {
          setPos({ x, y });
          frame.current = null;
        });
        if (!visible) setVisible(true);
      }}
      onPointerLeave={() => setVisible(false)}
    >
      <motion.span
        className="pointer-events-none absolute inset-0 z-0 hidden lg:block"
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: `radial-gradient(34rem 34rem at ${pos.x}% ${pos.y}%, color-mix(in oklab, var(--color-saffron) 16%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
