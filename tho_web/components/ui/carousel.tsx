"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * makes a scrollable row look like a clipped one. So everything below exists to put that
 * information back, in the ways a pointer, a finger and a keyboard each expect.
 *
 * ## The five ways this scrolls, and which are free
 *
 * **Trackpad, wheel and touch swipe are native and untouched.** No listener intercepts
 * them, which is the point: momentum, rubber-banding and two-finger horizontal gestures
 * are the browser's, and every hand-written version of them is worse. `scrollbar-none`
 * (see `globals.css`) hides the indicator without touching the overflow.
 *
 * **Mouse drag is the one that has to be built**, because no browser offers it. It is
 * gated on `pointerType === "mouse"`: a touch drag is already a swipe, and running both
 * would fight the native gesture for the same pixels.
 *
 * **Keyboard needs nothing** — every card holds a link, so Tab moves through them and the
 * browser scrolls each into view. That is also why this is not `tabIndex={0}`: a focusable
 * scroll container in front of N focusable cards is one extra stop per row, on a page with
 * five rows, for a job the cards already do.
 *
 * **The arrows are for the pointer user with no gesture** — a plain mouse, no wheel tilt.
 * They page by ~90% of the visible width rather than by one card, so nothing is skipped
 * over: the partially-visible card at the edge becomes the first fully-visible one.
 *
 * ## Three things fight drag-to-scroll, and all three are turned off for its duration
 *
 * Every one of these was a real symptom before it was a line of code:
 *
 * 1. **`scroll-behavior: smooth`.** With it on, each `scrollLeft` assignment starts a
 *    *new* animation to a target the next frame has already moved — the row lags a few
 *    hundred milliseconds behind the cursor and overshoots on release.
 * 2. **`scroll-snap-type: mandatory`.** It re-snaps on every assignment, so a drag
 *    ratchets between cards instead of tracking the pointer. Restored on release, which
 *    is when snapping is actually wanted: the row settles onto a card edge.
 * 3. **Text and image selection.** A drag across a card otherwise selects its name, and
 *    Chrome starts a native image drag from the cover. `select-none` and a `dragstart`
 *    guard, both only while the pointer is down.
 *
 * And the fourth: **a drag ends in a `click`**, on whatever card was under the cursor, so
 * a fling across the row navigates. A capture-phase listener swallows exactly one click
 * after a drag that moved more than `DRAG_SLOP`. The threshold is what keeps a *press*
 * working — a click with 2px of hand-shake in it is still a click.
 *
 * ## `setPointerCapture` is taken on the first real movement, never on pointerdown
 *
 * This is the one that has to be right, because getting it wrong breaks the *cards* and
 * not the scrolling — so nothing about the row looks broken.
 *
 * Capturing the pointer **retargets the compatibility `click` to the capturing element**.
 * With the capture taken in `pointerdown`, every press on a card fired its `click` at this
 * `<ul>` instead of at the card's link, so **no card in any carousel was clickable with a
 * mouse**. Measured: `pointerdown.target` was the anchor and `click.target` was
 * `UL.scrollbar-none`, `href` null. Releasing capture in `pointerup` does not help — the
 * click's target is already decided by then.
 *
 * Taking it only once travel passes `DRAG_SLOP` fixes it at the root: a press never
 * captures, so its click reaches the card; a drag captures, so it keeps tracking when the
 * cursor leaves the row. It also means the retargeting works *for* us on a real drag —
 * the click lands on the `<ul>`, where there is nothing to navigate.
 *
 * The cost of a late capture is a release that happens outside this element, where no
 * `pointerup` reaches us. `pointermove` with no buttons down is the recovery.
 *
 * ## The fades are computed, not decorative
 *
 * Each edge fades only while there is something past it, so the pair is a live readout of
 * position: both means "middle", neither means "everything fits and this row does not
 * scroll at all". A gradient painted unconditionally would say "there is more" on a row
 * of two cards. `EDGE_SLOP` absorbs the sub-pixel `scrollWidth` a fractional layout
 * leaves, which otherwise pins the right fade on for ever at the end of the row.
 */

/** Pointer travel, in px, past which a press becomes a drag and the click is swallowed. */
const DRAG_SLOP = 6;

/** Sub-pixel tolerance when deciding whether an edge has more content past it. */
const EDGE_SLOP = 2;

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
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
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
    // when the filter rail appears at 1128 and when a card's image finally lays out, and
    // neither of those is a window resize.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, children]);

  function page(direction: -1 | 1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

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

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={track}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // Capture phase, so this runs before the card's own link sees the event.
        onClickCapture={(e) => {
          if (!moved.current) return;
          moved.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragStart={(e) => {
          // Chrome would otherwise start a native image drag from a cover photo, which
          // ends the pointer sequence and leaves the row stuck mid-drag.
          if (dragging) e.preventDefault();
        }}
        className={cn(
          "scrollbar-none snap-x snap-mandatory flex overflow-x-auto scroll-smooth",
          itemGap,
          // `-my-2 py-2` buys vertical room inside the scroll port without adding any to
          // the page: an `overflow-x` container is a scroll container on **both** axes,
          // so a card's focus outline (drawn at `-inset-2`) would be clipped by the very
          // element that scrolls it. The negative margin gives the two back to the layout.
          "-my-2 py-2",
          // `contain` stops a horizontal fling at the end of the row from turning into a
          // browser back-swipe or a scroll of the page behind it.
          "overscroll-x-contain",
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
