"use client";

import { useSyncExternalStore } from "react";

/**
 * `prefers-reduced-motion`, read the way React 19 wants an external source read.
 *
 * **Extracted from `confetti-burst.tsx` rather than reimplemented**, the same move
 * `useDialogOverlay` records: the burst had this hook inline, the guide player needs the
 * identical answer, and a second copy is how two components end up disagreeing about
 * whether somebody asked for less motion.
 *
 * Not `useState` + `useEffect`: that is setting state in an effect, which the
 * `react-hooks/set-state-in-effect` rule refuses — and rightly, since it renders once with
 * a guessed value and then again with the real one. `useSyncExternalStore` has a server
 * snapshot (**true** — assume reduced, so nothing can flash before the query is known) and
 * subscribes, so somebody who changes the preference mid-session is honoured without a
 * reload.
 */
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * One `MediaQueryList`, made on first use.
 *
 * `getSnapshot` runs on every render of every consumer and again on every notification, and
 * `matchMedia` parses the query and allocates a fresh object each time it is called — so the
 * naive form built one per render to read a boolean off it. Lazy rather than module-level
 * because this module is imported by server components too; `getServerSnapshot` never reaches
 * it, so `window` is only touched once something client-side actually asks.
 */
let query: MediaQueryList | null = null;
const media = () => (query ??= window.matchMedia(REDUCED_QUERY));

function subscribe(onChange: () => void) {
  const q = media();
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => media().matches,
    () => true,
  );
}
