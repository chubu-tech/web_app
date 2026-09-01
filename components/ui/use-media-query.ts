"use client";

import { useSyncExternalStore } from "react";

/**
 * Any media query, read the way React 19 wants an external source read.
 *
 * A generalisation of `usePrefersReducedMotion`, written to the same three rules that file
 * records, because they are the ones that make this correct rather than merely working:
 *
 * - **`useSyncExternalStore`, not `useState` + `useEffect`.** Setting state in an effect is what
 *   `react-hooks/set-state-in-effect` refuses, and it renders once with a guessed value and again
 *   with the real one.
 * - **One `MediaQueryList` per query, made on first use.** `getSnapshot` runs on every render of
 *   every consumer and again on every notification, and `matchMedia` parses the query and
 *   allocates a fresh object each call — so the naive form builds one per render to read a boolean
 *   off it. Lazy rather than module-level because server components import the modules that use
 *   this; `getServerSnapshot` never touches `window`.
 * - **The queries are cached by string**, so two components asking the same question share one
 *   listener and cannot disagree.
 *
 * ## The server snapshot is `false`, and that is a decision per caller
 *
 * `usePrefersReducedMotion` answers **true** on the server, because assuming "less motion" means
 * nothing can flash before the truth is known. A width query has no equivalent safe side, so this
 * answers **false** — "assume the smaller layout" — which is the same direction Tailwind's
 * mobile-first breakpoints take and means a narrow client never has to tear down a wide layout it
 * was never entitled to.
 *
 * A caller that needs the opposite default should not pass a flag; it should invert its query.
 */
const cache = new Map<string, MediaQueryList>();

function media(query: string): MediaQueryList {
  let list = cache.get(query);
  if (!list) {
    list = window.matchMedia(query);
    cache.set(query, list);
  }
  return list;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = media(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => media(query).matches,
    () => false,
  );
}
