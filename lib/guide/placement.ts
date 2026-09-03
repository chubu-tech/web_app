/**
 * Where the floating guide button may sit, and where it may not appear at all.
 *
 * This is pure geometry over a pathname, kept out of the component for the reason
 * `AGENTS.md` gives about the client/server boundary: a helper that lives beside a
 * `"use client"` component arrives at a server component as a client *reference*
 * the day something imports it from the other side. It is also the only part of
 * the launcher worth testing, and testing it needs no DOM.
 *
 * ## The problem it solves
 *
 * A button pinned to the bottom-right corner is in the way of exactly the controls
 * this product cares most about. Six surfaces pin something to the bottom edge —
 * the cart bar, three booking CTAs, the walk-in footer and the chat composer — and
 * a help button sitting on top of *"Book 09:00 · Nu. 150"* would be the single
 * worst thing this feature could do. So the button is lifted clear, per route.
 *
 * ## And one route where it must not render
 *
 * `/map` draws OpenStreetMap tiles, whose usage policy **requires visible
 * attribution**, and that credit sits in the bottom-right corner — the same corner
 * this button wants. Covering a licence condition is not a layout problem, so on
 * `/map` the button is not drawn at all. `AGENTS.md` is explicit that the
 * attribution is rendered here deliberately where the Flutter app omits it; do not
 * make this the thing that undoes that.
 *
 * ## Routes are matched exactly, never by prefix
 *
 * `/salon` and `/salons` are different pages, and so are `/queue` and `/q`. A
 * prefix test that lifts the button on `/salons` because `/salon/[id]` needs it
 * would be wrong on the busiest route in the product. Every rule here either
 * matches the whole path or matches a segment count as well as a stem.
 */

/**
 * How far above the bottom edge the button sits, in pixels, before the safe-area
 * inset is added by the caller.
 *
 * `--cta-clearance` is already `96px` in `globals.css` and is the height those
 * footers reserve, so `CTA` agrees with it rather than inventing a second number.
 * If that token changes, change this with it.
 */
const LIFT = {
  /** Nothing underneath — the button sits in the corner. */
  base: 16,
  /** Above `CartBar`: a 56px pill plus its own 8px inset, plus a gap. */
  cart: 88,
  /** Above a full-width CTA footer — the three booking bars and the walk-in one. */
  cta: 112,
  /** Above the chat composer, which is shorter than a CTA footer. */
  composer: 96,
} as const;

/** Split a pathname into non-empty segments. `/salon/abc/` -> `["salon","abc"]`. */
function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/**
 * The routes that pin a full-width primary action to the bottom edge.
 *
 * Two of them — the salon page and the booking wizard — render that footer
 * `desktop:hidden`, so above 1128 there is nothing to clear. That is what `wide`
 * is for; without it the button would float 112px up on a desktop with empty space
 * beneath it, which reads as a bug rather than as deference.
 */
function hasCtaFooter(parts: string[], wide: boolean): boolean {
  // `/bookings/<id>/reschedule` — `reschedule-flow.tsx`, fixed at every width.
  if (parts.length === 3 && parts[0] === "bookings" && parts[2] === "reschedule") {
    return true;
  }
  // `/business/walk-in` — a sticky footer, which occupies the same lane.
  if (parts.length === 2 && parts[0] === "business" && parts[1] === "walk-in") {
    return true;
  }
  if (wide) return false;
  // `/salon/<id>/book` — `booking-summary.tsx`, `desktop:hidden`.
  if (parts.length === 3 && parts[0] === "salon" && parts[2] === "book") return true;
  // `/salon/<id>` — `salon-booking.tsx`'s Book Appointment bar, `desktop:hidden`.
  if (parts.length === 2 && parts[0] === "salon") return true;
  return false;
}

/** `/messages/<id>` and `/business/messages/<id>` — a sticky composer on the edge. */
function hasComposer(parts: string[]): boolean {
  if (parts.length === 2 && parts[0] === "messages") return true;
  if (parts.length === 3 && parts[0] === "business" && parts[1] === "messages") {
    return true;
  }
  return false;
}

/**
 * How far to lift the launcher on this route, or `null` to draw nothing.
 *
 * `cartVisible` is passed in rather than read here because only the customer shell
 * mounts `CartBar`: in the console and on the marketing site the answer is
 * structurally always `false`, and reading the cart to be told so would subscribe
 * every one of those pages to `localStorage` for a value that cannot vary.
 *
 * `wide` is the app's own desktop breakpoint (1128), because two of the CTA
 * footers are `desktop:hidden`.
 */
export function launcherLift({
  pathname,
  cartVisible = false,
  wide = false,
}: {
  pathname: string;
  cartVisible?: boolean;
  wide?: boolean;
}): number | null {
  const parts = segments(pathname);

  // The one route that gets no button at all. Exact, so a future `/map-help`
  // does not inherit the refusal.
  if (parts.length === 1 && parts[0] === "map") return null;

  // The tallest occupied lane wins. They can genuinely co-occur — a salon page
  // has a Book bar and can have a cart bar at the same time — and clearing only
  // one of them puts the button on the other.
  let lift: number = LIFT.base;
  if (cartVisible) lift = Math.max(lift, LIFT.cart);
  if (hasComposer(parts)) lift = Math.max(lift, LIFT.composer);
  if (hasCtaFooter(parts, wide)) lift = Math.max(lift, LIFT.cta);
  return lift;
}

/** Exported for the tests, so a changed constant fails loudly rather than silently. */
export const LAUNCHER_LIFT = LIFT;
