"use client";

import { CAROUSEL_TRACK, useCarousel } from "./use-carousel";
import { Icons, IconSize } from "./icons";
import { cn } from "@/lib/utils";

/**
 * A horizontal row of cards with **no scrollbar** and every other way of moving it
 * intact — the shape Fresha's home page uses, and the one every Discover row now takes.
 *
 * It replaced five hand-rolled copies of `flex overflow-x-auto pb-2`, which shared one
 * problem: on Windows and on Linux that renders a permanent grey bar under every row, so
 * a page of four carousels drew four of them. Hiding the bar is only half a change
 * though — a scrollbar is an *affordance*, not decoration, and removing it silently
 * makes a scrollable row look like a clipped one. So everything here exists to put that
 * information back, in the ways a pointer, a finger and a keyboard each expect.
 *
 * **The scrolling itself lives in `use-carousel.ts`**, along with the four subtleties
 * that took measurement to get right — read that file before touching a gesture. This
 * one is the product shell's chrome over it: the icon set, the `cn`, the fades and the
 * two arrows. `components/marketing/ui/rail.tsx` is the marketing site's chrome over the
 * same hook, and the split is what stops there being a sixth hand-rolled copy.
 *
 * ## The fades are computed, not decorative
 *
 * Each edge fades only while there is something past it, so the pair is a live readout of
 * position: both means "middle", neither means "everything fits and this row does not
 * scroll at all". A gradient painted unconditionally would say "there is more" on a row
 * of two cards.
 */
export function Carousel({
  children,
  label,
  className,
  itemGap = "gap-lg",
}: {
  /** The items, each an `<li>`. This renders the `<ul>`. */
  children: React.ReactNode;
  /** Names the scroll region and its two arrows for a screen reader. */
  label: string;
  className?: string;
  /** The gap utility between items. `gap-lg` (24px) unless a row wants tighter. */
  itemGap?: string;
}) {
  const { trackProps, edges, dragging, page } = useCarousel(children);

  return (
    <div className={cn("relative", className)}>
      <ul
        {...trackProps}
        className={cn(
          CAROUSEL_TRACK,
          itemGap,
          dragging ? "cursor-grabbing select-none" : "cursor-grab",
        )}
      >
        {children}
      </ul>

      {/*
        The two fades and the two arrows, each shown only while its side has more.

        `pointer-events-none` on the fades matters more than it looks: they sit over the
        first and last card, and without it the leftmost card would have a 48px strip
        along its edge that could not be clicked or dragged.
      */}
      <Edge side="left" show={edges.left} />
      <Edge side="right" show={edges.right} />

      <Arrow side="left" show={edges.left} label={label} onClick={() => page(-1)} />
      <Arrow side="right" show={edges.right} label={label} onClick={() => page(1)} />
    </div>
  );
}

function Edge({ side, show }: { side: "left" | "right"; show: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "from-canvas pointer-events-none absolute inset-y-0 w-12 to-transparent transition-opacity duration-[var(--duration-base)]",
        side === "left" ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l",
        show ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/**
 * One paging arrow.
 *
 * `hidden tablet:grid` because below 744 the row is being swiped, and a 40px control
 * parked over the first card costs more than it gives on the width where cards are
 * widest relative to the viewport.
 *
 * Hidden from the accessibility tree, not just visually, when its side has nothing left —
 * `invisible` rather than unmounting so the row does not reflow, plus `aria-hidden` and
 * `tabIndex={-1}` so a keyboard user never lands on a control that would do nothing.
 */
function Arrow({
  side,
  show,
  label,
  onClick,
}: {
  side: "left" | "right";
  show: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? Icons.chevronLeft : Icons.chevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      aria-label={`${side === "left" ? "Previous" : "Next"} — ${label}`}
      className={cn(
        "bg-canvas/92 text-ink shadow-card absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full backdrop-blur-sm",
        "hover:bg-canvas transition-opacity duration-[var(--duration-base)]",
        side === "left" ? "left-1" : "right-1",
        show ? "opacity-100 tablet:grid" : "invisible opacity-0 tablet:grid",
      )}
    >
      <Icon style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
    </button>
  );
}
