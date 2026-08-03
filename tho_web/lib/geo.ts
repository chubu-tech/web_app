import { distanceKm } from "./booking-guards";
import type { Coords } from "./discover-logic";

/**
 * Resolving where the viewer is, ported from `_resolveLocation` in
 * `tho/app/lib/customer/customer_home.dart:335`.
 *
 * One fix serves the recommender, the Nearby row and the distance filter. The app
 * takes it eagerly on mount rather than lazily behind whichever section reads it
 * first, and `customer_home.dart:304-313` records why: resolving it as a side
 * effect of building a subtree meant that typing a search term before the sections
 * rendered left the location null for the rest of the session, and the distance
 * filter silently never applied.
 */

/** `kThimphuCenter` in `map_view.dart`. The fallback whenever GPS can't be trusted. */
export const THIMPHU_CENTER: Coords = { lat: 27.4728, lng: 89.639 };

/**
 * How far from Thimphu a fix may be before it is treated as nonsense.
 *
 * Bhutan is ~300 km across and every salon on the platform is inside it, so a fix
 * from another continent is a simulator, a VPN-shifted geolocation lookup, or a
 * desktop browser guessing from an IP address — and ranking "nearby" salons against
 * it would put the whole list in a meaningless order. Falling back to Thimphu at
 * least ranks against somewhere real.
 */
export const MAX_PLAUSIBLE_KM = 150;

/** The fix if it is plausibly in Bhutan, otherwise the Thimphu centre. */
export function plausibleFix(gps: Coords): Coords {
  return distanceKm(THIMPHU_CENTER, gps) <= MAX_PLAUSIBLE_KM ? gps : THIMPHU_CENTER;
}

/**
 * A resolved location, and **whether it is really the viewer's**.
 *
 * The distinction is not bookkeeping: the Discover header states where distances are
 * measured from, and it may only say "near you" when that is true. `'fallback'`
 * covers a denied prompt, no sensor, a timeout, and a fix too far from Bhutan to
 * believe — in every one of those the reference point is the Thimphu centre, so that
 * is what the header should name.
 */
export type Fix = { coords: Coords; source: "gps" | "fallback" };

/** How long to wait for the browser before giving up and using the fallback. */
const TIMEOUT_MS = 6000;

/**
 * A best-effort location. **Never rejects** — a denied prompt, an unavailable
 * sensor, a timeout and an implausible answer all resolve to the Thimphu centre, so
 * every caller gets coordinates and none has to handle a failure.
 *
 * Note that this asks for permission, so call it from a real page and not from a
 * component that might mount on a route the viewer never looks at.
 */
export function resolveLocation(): Promise<Fix> {
  const fallback: Fix = { coords: THIMPHU_CENTER, source: "fallback" };
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(fallback);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: Fix) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const raw = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const coords = plausibleFix(raw);
        // An implausible fix was *replaced*, so it is no longer the viewer's
        // position and must not be described as one.
        done(coords === raw ? { coords, source: "gps" } : fallback);
      },
      () => done(fallback),
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 5 * 60_000 },
    );
    // Belt and braces: some browsers never invoke either callback when the
    // permission prompt is dismissed rather than answered, and a Discover screen
    // that waits forever for a section is worse than one that assumes Thimphu.
    setTimeout(() => done(fallback), TIMEOUT_MS + 500);
  });
}
