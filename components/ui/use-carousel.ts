"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The mechanics of a horizontal card rail: native scrolling, mouse drag, edge
 * detection and paging. **No chrome, no icons, no design tokens** — every one of
 * those differs between the product shell and the marketing site, and the
 * mechanics do not.
 *
 * Extracted from `carousel.tsx` for the same reason `use-dialog-overlay.ts` was
 * extracted from `Sheet`: a second surface needed the behaviour and copying it
 * would have meant maintaining two of the four subtleties below. The move is
 * verbatim, so the risk is uniform rather than per-caller.
 *
 * The marketing rail cannot simply import `Carousel`. That component's arrows come
 * from `components/ui/icons.ts`, which is a **96-entry object literal** — a shape no
 * bundler can tree-shake, so importing it would put ninety-six lucide components
 * into the chunk of a statically-prerendered landing page for the sake of two
 * chevrons. Sharing the hook shares the hard part and costs nothing.
 *
 * ## The five ways this scrolls, and which are free
 *
 * **Trackpad, wheel and touch swipe are native and untouched.** No listener
 * intercepts them, which is the point: momentum, rubber-banding and two-finger
 * horizontal gestures are the browser's, and every hand-written version of them is
 * worse. `scrollbar-none` (see `globals.css`) hides the indicator without touching
 * the overflow.
 *
 * **Mouse drag is the one that has to be built**, because no browser offers it. It
 * is gated on `pointerType === "mouse"`: a touch drag is already a swipe, and
 * running both would fight the native gesture for the same pixels.
 *
 * **Keyboard needs nothing** — every card holds a link, so Tab moves through them
 * and the browser scrolls each into view. That is also why the track is not
 * `tabIndex={0}`: a focusable scroll container in front of N focusable cards is one
 * extra stop per row, for a job the cards already do.
 *
 * **The arrows are for the pointer user with no gesture** — a plain mouse, no wheel
 * tilt. `page()` moves by ~90% of the visible width rather than by one card, so
 * nothing is skipped over: the partially-visible card at the edge becomes the first
 * fully-visible one.
 *
 * ## Three things fight drag-to-scroll, and all three are turned off for its duration
 *
 * Every one of these was a real symptom before it was a line of code:
 *
 * 1. **`scroll-behavior: smooth`.** With it on, each `scrollLeft` assignment starts a
 *    *new* animation to a target the next frame has already moved — the row lags a
 *    few hundred milliseconds behind the cursor and overshoots on release.
 * 2. **`scroll-snap-type: mandatory`.** It re-snaps on every assignment, so a drag
 *    ratchets between cards instead of tracking the pointer. Restored on release,
 *    which is when snapping is actually wanted: the row settles onto a card edge.
 * 3. **Text and image selection.** A drag across a card otherwise selects its name,
 *    and Chrome starts a native image drag from the cover. The caller applies
 *    `select-none` while `dragging`; the `onDragStart` guard is here.
 *
 * And the fourth: **a drag ends in a `click`**, on whatever card was under the
 * cursor, so a fling across the row navigates. A capture-phase listener swallows
 * exactly one click after a drag that moved more than `DRAG_SLOP`. The threshold is
 * what keeps a *press* working — a click with 2px of hand-shake in it is still a
 * click.
 *
 * ## `setPointerCapture` is taken on the first real movement, never on pointerdown
 *
 * This is the one that has to be right, because getting it wrong breaks the *cards*
 * and not the scrolling — so nothing about the row looks broken.
 *
 * Capturing the pointer **retargets the compatibility `click` to the capturing
 * element**. With the capture taken in `pointerdown`, every press on a card fired its
 * `click` at the `<ul>` instead of at the card's link, so **no card in any carousel
 * was clickable with a mouse**. Measured: `pointerdown.target` was the anchor and
 * `click.target` was `UL.scrollbar-none`, `href` null. Releasing capture in
 * `pointerup` does not help — the click's target is already decided by then.
 *
 * Taking it only once travel passes `DRAG_SLOP` fixes it at the root: a press never
 * captures, so its click reaches the card; a drag captures, so it keeps tracking when
 * the cursor leaves the row. It also means the retargeting works *for* us on a real
 * drag — the click lands on the `<ul>`, where there is nothing to navigate.
 *
 * The cost of a late capture is a release that happens outside this element, where no
 * `pointerup` reaches us. `pointermove` with no buttons down is the recovery.
 */

/** Pointer travel, in px, past which a press becomes a drag and the click is swallowed. */
const DRAG_SLOP = 6;

/** Sub-pixel tolerance when deciding whether an edge has more content past it. */
const EDGE_SLOP = 2;

/**
 * The utilities the scrolling element must carry. A constant rather than something
 * the caller retypes, because every one of them is load-bearing:
 *
 * - `-my-2 py-2` buys vertical room inside the scroll port without adding any to the
 *   page. An `overflow-x` container is a scroll container on **both** axes, so a
 *   card's focus outline (drawn at a negative inset) would be clipped by the very
 *   element that scrolls it. The negative margin gives the two back to the layout.
 * - `overscroll-x-contain` stops a horizontal fling at the end of the row from turning
 *   into a browser back-swipe or a scroll of the page behind it.
 *
 * The gap and the item widths stay with the caller — those are layout, not mechanics.
 */
export const CAROUSEL_TRACK =
  "scrollbar-none snap-x snap-mandatory flex overflow-x-auto scroll-smooth -my-2 py-2 overscroll-x-contain";

/** Which sides still have content past them. Both false means the row does not scroll. */
export type CarouselEdges = { left: boolean; right: boolean };

export type Carousel = {
  /** Spread onto the scrolling `<ul>`; carries the ref and every listener. */
  trackProps: React.ComponentPropsWithRef<"ul">;
  /** A live readout of position — drive the fades and the arrows from it. */
  edges: CarouselEdges;
  /** True while a mouse drag is in progress. The caller turns off selection with it. */
  dragging: boolean;
  /** Page by ~90% of the visible width. `-1` is left. */
  page: (direction: -1 | 1) => void;
};

/**
 * @param contents Re-measure when this changes — the caller's children. A row whose
 * items change length has a different `scrollWidth`, and nothing else would say so.
 */
export function useCarousel(contents: unknown): Carousel {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState<CarouselEdges>({
    left: false,
    right: false,
  });
  const [dragging, setDragging] = useState(false);

  // Drag bookkeeping lives in refs, not state: it changes on every pointermove and a
  // re-render per frame would be the one expensive thing in an otherwise free gesture.
  const origin = useRef({ x: 0, scroll: 0 });
  const moved = useRef(false);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > EDGE_SLOP,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - EDGE_SLOP,
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    // `ResizeObserver` rather than a window resize listener: the row also changes width
    // when a rail appears at a breakpoint and when a card's image finally lays out, and
    // neither of those is a window resize.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, contents]);

  const page = useCallback((direction: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLUListElement>) {
    // Mouse only, primary button only. Touch is already a swipe; pen is closer to touch.
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = track.current;
    if (!el) return;
    origin.current = { x: e.clientX, scroll: el.scrollLeft };
    moved.current = false;
    setDragging(true);
    // See the header: both of these would fight the assignments in `onPointerMove`.
    el.style.scrollBehavior = "auto";
    el.style.scrollSnapType = "none";
    // No `setPointerCapture` here. See the header — it is taken on the first movement
    // past the slop, because capturing on the press makes every card unclickable.
  }

  function onPointerMove(e: React.PointerEvent<HTMLUListElement>) {
    if (!dragging) return;
    const el = track.current;
    if (!el) return;
    // The button came up somewhere we never heard about — off the row, or outside the
    // window before the capture was taken. Without this the row stays in its dragging
    // state and follows the cursor with nothing held down.
    if (e.buttons === 0) {
      endDrag(e);
      return;
    }
    const dx = e.clientX - origin.current.x;
    if (Math.abs(dx) > DRAG_SLOP) {
      moved.current = true;
      if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = origin.current.scroll - dx;
  }

  function endDrag(e: React.PointerEvent<HTMLUListElement>) {
    if (!dragging) return;
    const el = track.current;
    setDragging(false);
    if (el) {
      // Cleared rather than set back to a value: both belong to the class list, and
      // writing them back inline would shadow any future change to it.
      el.style.scrollBehavior = "";
      el.style.scrollSnapType = "";
    }
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  return {
    edges,
    dragging,
    page,
    trackProps: {
      ref: track,
      onScroll: measure,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      // Capture phase, so this runs before the card's own link sees the event.
      onClickCapture: (e) => {
        if (!moved.current) return;
        moved.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
      onDragStart: (e) => {
        // Chrome would otherwise start a native image drag from a cover photo, which
        // ends the pointer sequence and leaves the row stuck mid-drag.
        if (dragging) e.preventDefault();
      },
    },
  };
}
