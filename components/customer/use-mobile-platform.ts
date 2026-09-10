"use client";

import { useSyncExternalStore } from "react";
import { type MobilePlatform, detectMobilePlatform } from "@/lib/app-links";

/**
 * Which phone this is, or null for a desktop browser.
 *
 * **`useSyncExternalStore`, not `useState` + `useEffect`** — the same call
 * `usePrefersReducedMotion` makes and for the same reason: the
 * `react-hooks/set-state-in-effect` rule refuses a setter called from an effect body, and
 * the pattern it refuses is genuinely worse here. Reading the user agent in an effect
 * renders once with a guessed platform and then again with the real one, which on this
 * surface means a store button that visibly changes which store it names.
 *
 * The server snapshot is **null**, which is the honest answer: a server rendering a page
 * that may be cached cannot know whose phone will read it. So the first paint offers both
 * listings and the hydrated render narrows to one — never the other way round, and never a
 * wrong store shown first.
 *
 * `subscribe` is a no-op returning a no-op teardown. A user agent does not change for the
 * life of a document, so there is nothing to listen to; the hook is being used for its
 * server/client snapshot split, not for its subscription. `getSnapshot` is
 * deterministic and returns a string or null, so React's `Object.is` comparison settles
 * immediately rather than looping.
 */
const noop = () => () => {};

function snapshot(): MobilePlatform | null {
  return detectMobilePlatform(navigator.userAgent, navigator.maxTouchPoints);
}

export function useMobilePlatform(): MobilePlatform | null {
  return useSyncExternalStore(noop, snapshot, () => null);
}
