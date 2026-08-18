"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * A one-shot confetti burst — a port of `confetti_burst.dart` / `Celebration.play`.
 *
 * Upstream spends this in exactly two places, and they are the two peaks of the journey: the
 * booking-confirmed sheet (*"The confetti kit was already in the codebase, spent on loyalty
 * coupons and the cart. This is the peak of the journey; it belongs here."*) and a redeemed
 * reward. Both are moments where somebody has *got* something, which is the test for whether a
 * celebration is earned or merely decorative.
 *
 * ## No dependency, and no render loop
 *
 * The Dart drives a `CustomPainter` from an `AnimationController`. Here each particle is a
 * `<span>` carrying its own trajectory as CSS custom properties, animated by one keyframe
 * (`confetti-fly` in `globals.css`). Twenty-four elements and no JavaScript per frame — the same
 * call `charts.tsx` makes about not adding a library for six visualisations.
 *
 * ## It declines to run under `prefers-reduced-motion`
 *
 * The app-wide rule at the foot of `globals.css` clamps every animation to 0.01ms, which for
 * this would mean 24 dots appearing and disappearing inside one frame — a flash, which is
 * exactly what that preference exists to prevent. So this checks the query itself and renders
 * nothing. A celebration is the one thing that is genuinely better absent than degraded.
 *
 * ## Trajectories are generated once, on the client
 *
 * In a `useState` initialiser rather than during render: `Math.random()` in a render body would
 * give different values on a double-render under Strict Mode, and the burst only ever mounts
 * after a user action, so there is no server render to mismatch.
 */
export function ConfettiBurst({
  particles = 24,
  durationMs = 1400,
  onDone,
}: {
  particles?: number;
  durationMs?: number;
  /** Called once the burst is spent, so the caller can unmount it. */
  onDone?: () => void;
}) {
  const reduced = usePrefersReducedMotion();

  const [pieces] = useState(() =>
    Array.from({ length: particles }, (_, i) => {
      // Spread over the full circle with a little jitter, so the burst is even but not a
      // starburst — the Dart's own distribution.
      const angle = (i / particles) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 90 + Math.random() * 110;
      return {
        dx: `${Math.cos(angle) * distance}px`,
        // Biased downward: confetti falls, and a symmetric burst reads as an explosion.
        dy: `${Math.sin(angle) * distance + 60}px`,
        spin: `${(Math.random() - 0.5) * 720}deg`,
        delay: `${Math.random() * 120}ms`,
        size: 6 + Math.round(Math.random() * 5),
        // Coral, the star gold and the ink — the three colours already in the palette. No new
        // token for a 1.4-second event.
        colour: ["var(--color-rausch)", "var(--color-star)", "var(--color-ink)"][i % 3]!,
        round: i % 2 === 0,
      };
    }),
  );

  useEffect(() => {
    if (reduced || !onDone) return;
    const timer = setTimeout(onDone, durationMs + 200);
    return () => clearTimeout(timer);
  }, [reduced, durationMs, onDone]);

  if (reduced) return null;

  return (
    /* Fixed and centred, above everything, and deliberately inert: `pointer-events-none` so it
       cannot intercept the press on whatever the customer wants to do next, and `aria-hidden`
       because a screen reader has already been told the good news in words. */
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      style={{ contain: "strict" }}
    >
      <div className="absolute left-1/2 top-1/3">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="absolute block"
            style={
              {
                width: p.size,
                height: p.round ? p.size : p.size * 0.5,
                background: p.colour,
                borderRadius: p.round ? "9999px" : "1px",
                animation: `confetti-fly ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1) ${p.delay} both`,
                "--dx": p.dx,
                "--dy": p.dy,
                "--spin": p.spin,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
