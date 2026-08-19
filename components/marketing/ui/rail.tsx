"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { CAROUSEL_TRACK, useCarousel } from "@/components/ui/use-carousel";
import { cn } from "@/lib/marketing/utils";

/**
 * A swipeable row of cards — the shape the reference marketplace uses for every
 * curated band on its home page, and the shape a salon band takes here at **every**
 * width.
 *
 * ## Why a rail rather than a grid
 *
 * The grid this replaced collapsed to one column below 640, which stacked four salons
 * vertically and turned a shortlist into something read like a list of blog posts —
 * four full-bleed photographs to scroll past before the next section of the page.
 * A rail puts the whole band in one screen: one card at a time with the next one
 * peeking, so the fact that there *is* a next one is visible rather than implied.
 *
 * It stays a rail upward too, at 2 · 3 · 4 cards across (the widths live on the `<li>`
 * in `find-salon.tsx`). Above a certain width the shortlist simply fits, and then the
 * rail is inert: the fades and both arrows measure their own overflow and disappear
 * when there is none, so a band of four salons on a desktop reads exactly as the grid
 * did.
 *
 * ## The one import across the marketing / product line, and what it is not
 *
 * `useCarousel` is **mechanics only** — pointer capture, edge measurement, paging.
 * No tokens, no icons, no class strings beyond the scroll container itself. The
 * boundary this site keeps is a *design* boundary, and nothing about a drag gesture
 * is design. What is deliberately not imported is `components/ui/carousel.tsx`: its
 * arrows resolve through a 96-entry icon object that no bundler can tree-shake, and
 * this page is statically prerendered and cares about its bytes. Two chevrons,
 * imported directly, cost two chevrons.
 *
 * ## The chrome is this site's, not the product's
 *
 * Two deliberate differences from `Carousel`:
 *
 * 1. **Arrows appear at 640, not 744**, because that is where this site's own grid
 *    steps and where a second card comes into view.
 * 2. **They sit at 35% of the card's height, not 50%** — which is the middle of the
 *    *photograph* rather than the middle of the card, since the meta block below the
 *    image is roughly a third of it at every breakpoint. Centred on the card, the
 *    control lands on a salon's name.
 *
 * Below 640 there are no arrows at all. The row is being swiped there, and a control
 * parked over the first card is a 40px hole in the touch target on exactly the width
 * where the cards are widest.
 */
export function Rail({
  children,
  label,
  className,
  itemGap = "gap-4 sm:gap-5",
}: {
  /** The items, each an `<li>` carrying its own width and `snap-start`. */
  children: React.ReactNode;
  /** Names the scroll region and its two arrows for a screen reader. */
  label: string;
  className?: string;
  /** The gap utility between items. */
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
        One fade, on the right, and the asymmetry is deliberate.

        A fade softens a card the edge cuts through. Snapping is `snap-start` and
        mandatory, so at rest the **left** edge always has a card's leading edge flush
        against it — there is nothing there to soften, and a gradient over it only
        washes out the first letters of that salon's name and its category line.
        Measured on a 390px screen after one swipe: "Norzin Salon & Spa" lost its N.
        The right edge is the one that genuinely cuts a card in half, which is the
        whole point of the peek, so that fade stays.

        `pointer-events-none` is load-bearing: it sits over the last card, and without
        it that card would have a strip along its edge that could not be tapped or
        dragged.
      */}
      <Edge show={edges.right} />

      <Arrow
        side="left"
        show={edges.left}
        label={label}
        onClick={() => page(-1)}
      />
      <Arrow
        side="right"
        show={edges.right}
        label={label}
        onClick={() => page(1)}
      />
    </div>
  );
}

/** A live readout of position, not decoration — shown only while there is more past it. */
function Edge({ show }: { show: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "from-canvas pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent transition-opacity duration-300 sm:w-12",
        show ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/**
 * One paging arrow. Pages by ~90% of the visible width, so the card that was peeking
 * at the edge becomes the first fully-visible one and nothing is skipped over.
 *
 * Hidden from the accessibility tree, not just visually, when its side has nothing
 * left — `invisible` rather than unmounted so the row does not reflow, plus
 * `aria-hidden` and `tabIndex={-1}` so a keyboard user never lands on a control that
 * would do nothing.
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
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      aria-label={`${side === "left" ? "Previous" : "Next"} — ${label}`}
      className={cn(
        "bg-paper/95 text-ink shadow-card ring-hairline absolute top-[35%] hidden size-10 -translate-y-1/2 place-items-center rounded-full ring-1 ring-inset backdrop-blur-sm",
        "hover:bg-paper transition-opacity duration-300",
        side === "left" ? "left-2" : "right-2",
        show ? "opacity-100 sm:grid" : "invisible opacity-0 sm:grid",
      )}
    >
      <Icon className="size-5" strokeWidth={2} aria-hidden />
    </button>
  );
}
