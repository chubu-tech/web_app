/**
 * Where the floating guide button is allowed to sit.
 *
 * The requirement it exists for is "must not obstruct important content or navigation",
 * and on this app that is not a matter of taste — six surfaces pin a control to the bottom
 * edge, and a floating button in the corner would land on top of it:
 *
 * | Surface | What is pinned | Route |
 * | --- | --- | --- |
 * | `salon-booking.tsx` | Book call to action, `desktop:hidden` | `/salon/<id>` |
 * | `booking-summary.tsx` | the wizard's total + Continue, `desktop:hidden` | `/salon/<id>/book` |
 * | `reschedule-flow.tsx` | Confirm new time, every width | `/bookings/<id>/reschedule` |
 * | `chat-thread.tsx` | the message composer, sticky | `/messages/<id>`, `/business/messages/<id>` |
 * | `walk-in-form.tsx` | Add walk-in, sticky below 744 | `/business/walk-in` |
 * | `cart-bar.tsx` | the cart summary, whenever the cart has something in it | any customer route but `/cart` |
 *
 * So the button clears a **lane** on those routes rather than being hidden: a help
 * affordance that disappears on the page somebody is stuck on is worse than one sitting a
 * little higher. `/map` is the one exception and it is a licensing one — leaflet renders
 * OpenStreetMap's attribution in the bottom-right corner, the tile policy requires it to
 * stay visible, and the page is full-bleed with no room to move it. There the button is
 * not drawn at all.
 *
 * Pure and route-shaped so it can be pinned by tests: this is exactly the kind of rule
 * that rots silently when a page grows a footer, and `placement.test.ts` is the list of
 * what was true when it was written.
 */

/** The ordinary resting place: clear of the safe-area inset and nothing else. */
export const LIFT_BASE_PX = 16;

/**
 * One call-to-action lane. Matches `--cta-clearance` (96px), which is the floor those
 * footers are measured against — see the token's comment in `app/globals.css`.
 *
 * Applied at **every** width even though two of the five footers are `desktop:hidden`.
 * A button that sits 96px up on a wide screen looks deliberate; a matrix of
 * breakpoint-by-route offsets is the kind of thing that ends up wrong on one page nobody
 * opens at 1200px.
 */
export const LIFT_CTA_PX = 96;

/** The cart bar's own lane: its height plus the gap it holds off the bottom edge. */
export const LIFT_CART_PX = 64;

/** `null` means "do not render the launcher on this route at all". */
export type LauncherLift = number | null;

function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/**
 * True when this route pins its own control to the bottom edge.
 *
 * Segment-matched rather than `startsWith`, because `/salons` is a real route and is not
 * `/salon/<id>` — a prefix test would lift the button on the whole browse list for no
 * reason.
 */
function pinsBottomEdge(pathname: string): boolean {
  const parts = segments(pathname);

  // `/salon/<id>` and `/salon/<id>/book`.
  if (parts[0] === "salon" && parts.length >= 2) return true;

  // `/bookings/<id>/reschedule` — and only that; the detail page above it pins nothing.
  if (parts[0] === "bookings" && parts.length === 3 && parts[2] === "reschedule") return true;

  // A chat thread, either side of it. The list pages pin nothing.
  if (parts[0] === "messages" && parts.length === 2) return true;
  if (parts[0] === "business" && parts[1] === "messages" && parts.length === 3) return true;

  if (parts[0] === "business" && parts[1] === "walk-in") return true;

  return false;
}

/**
 * How far off the bottom edge the launcher sits, in pixels — or `null` to hide it.
 *
 * `cartVisible` is the caller's answer, not this module's, because it is state rather
 * than route: `CartBar` renders only when the cart has lines and never on `/cart`, and
 * this mirrors both conditions rather than re-deriving them.
 */
export function launcherLift({
  pathname,
  cartVisible,
}: {
  pathname: string;
  cartVisible: boolean;
}): LauncherLift {
  if (pathname === "/map") return null;

  const base = pinsBottomEdge(pathname) ? LIFT_CTA_PX : LIFT_BASE_PX;
  // `/cart` is excluded because `CartBar` hides itself there — a lane for a bar that is
  // not on screen would leave the button floating for no reason.
  const cart = cartVisible && pathname !== "/cart" ? LIFT_CART_PX : 0;
  return base + cart;
}
