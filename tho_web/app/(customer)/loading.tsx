import { SkeletonCards } from "@/components/ui/skeleton";

/**
 * The customer surface's streaming fallback.
 *
 * Every customer page reads cookies, so all 25 are dynamic and none of them can be served from
 * a static shell. Without a `loading.tsx` the segment has no Suspense boundary, so the browser
 * holds the *previous* page — or a blank document on a cold arrival — until the whole server
 * render finishes. The app shows `SkeletonList` on about ten screens for the same reason and
 * this repo had it on none: `components/ui/skeleton.tsx` existed and was only ever used *inside*
 * client components, where the data was already in flight.
 *
 * **Cards, not rows, and one shape for the whole group.** A per-route skeleton that matched each
 * page exactly would be twenty-five files, and the honest value of a fallback is "something is
 * coming, the chrome is real" rather than a promise about layout. Cards are the closest thing to
 * a house shape here — Discover, `/saved`, `/salons`, `/recommended` and `/top-rated` are all
 * card grids, and they are the routes somebody actually waits on.
 *
 * Note the docs' own aside: `loading.tsx` does not by itself make client navigation instant —
 * that needs an `unstable_instant` export per route. Deliberately not adopted here: it is a
 * change to caching semantics on 70 routes, and the problem being fixed is the first paint, not
 * the transition.
 */
export default function CustomerLoading() {
  return (
    <div className="px-base py-lg w-full tablet:px-lg">
      <SkeletonCards count={6} />
    </div>
  );
}
