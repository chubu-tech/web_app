"use client";

import { useEffect, useMemo, useState } from "react";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { MediaChip } from "@/components/ui/business-card";
import { formatKm, kmTo } from "@/lib/discover-logic";
import { resolveLocation, type Fix } from "@/lib/geo";
import { SALON_SORTS, SALON_SORT_LABELS, sortedBy, type SalonSort } from "@/lib/recommendations";
import type { Business } from "@/lib/types/salon";
import { SalonGrid } from "./salon-grid";

/**
 * Every salon, sortable — a port of `all_salons_screen.dart`, and the route behind
 * Discover's "See all salons".
 *
 * ## Why this is a client component when `/top-rated` is not
 *
 * One of its two orderings needs a **GPS fix**, which exists only in a browser behind a
 * permission prompt. `/top-rated` is a pure sort on a column the query already returns, so it
 * server-renders and is indexable; this page cannot be, for the half of the time somebody
 * asks for Nearest.
 *
 * ## The sort lives in the URL
 *
 * `?sort=nearest|topRated`, so the ordering survives a reload, a share and the back button —
 * the same call the calendar, the client book and the product browse all make. The app loses
 * its `ChoiceChip` selection the moment the screen is popped.
 *
 * ## Nearest is not offered until there is something to measure from
 *
 * `sortedBy(…, "nearest")` with no fix deliberately returns the input order rather than
 * silently falling back to another ordering — showing top-rated under a chip reading
 * "Nearest" would be worse than showing the order the page already had. That makes the
 * chip's own state the honest place to say so: it is **disabled while the fix is
 * outstanding**, and if the fix never arrives it stays that way with the reason on screen.
 * The app has the same dependency and simply defaults to Nearest when a fix exists, which
 * means its chip can be selected and do nothing.
 *
 * **Nothing is dropped by either ordering.** This is a browse, so an unrated or unlocated
 * salon is still listed — sorted last. On live data most salons are unrated and two of the
 * fourteen have no coordinates, so both tails are the common case, not an edge one.
 */
export function AllSalonsList({
  businesses,
  favouriteIds,
  initialSort,
}: {
  businesses: Business[];
  favouriteIds: string[];
  /** From `?sort=`, already validated by the route. */
  initialSort: SalonSort;
}) {
  const [sort, setSort] = useState<SalonSort>(initialSort);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(true);

  // On mount, not behind the chip: asking only when Nearest is pressed would put a
  // permission prompt between the press and the answer, and the fix is wanted for the
  // distance labels either way.
  useEffect(() => {
    let live = true;
    resolveLocation()
      .then((resolved) => {
        if (live) setFix(resolved);
      })
      .finally(() => {
        if (live) setLocating(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const from = fix?.coords ?? null;

  /**
   * The URL follows the chip rather than driving it.
   *
   * `history.replaceState`, not a `router.push`: this is a re-sort of data already in the
   * browser, so a navigation would re-run the server component and re-fetch every salon to
   * change an order. Replace rather than push so the back button leaves the page instead of
   * walking the customer back through their own sort choices.
   */
  function choose(next: SalonSort) {
    setSort(next);
    const url = new URL(window.location.href);
    url.searchParams.set("sort", next);
    window.history.replaceState(null, "", url);
  }

  const ordered = useMemo(() => sortedBy(businesses, sort, from), [businesses, sort, from]);

  const chips = useMemo(
    () =>
      Object.fromEntries(
        ordered.flatMap((b) => {
          const km = from ? kmTo(b, from) : null;
          return km == null ? [] : [[b.id, <MediaChip key={b.id}>{formatKm(km)}</MediaChip>]];
        }),
      ),
    [ordered, from],
  );

  if (businesses.length === 0) {
    return (
      <EmptyState
        icon={Icons.salon}
        title="No salons yet"
        message="As salons join Tho they will appear here."
      />
    );
  }

  return (
    <>
      <div className="gap-sm mb-lg flex flex-wrap items-center" role="group" aria-label="Sort">
        {SALON_SORTS.map((option) => {
          const unavailable = option === "nearest" && from == null;
          return (
            <Chip
              key={option}
              label={SALON_SORT_LABELS[option]}
              selected={sort === option}
              disabled={unavailable}
              className={unavailable ? "cursor-not-allowed opacity-50" : undefined}
              onClick={() => choose(option)}
            />
          );
        })}
        {from == null ? (
          <span className="text-caption text-muted gap-xs inline-flex items-center">
            <Icons.nearMe
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              aria-hidden
            />
            {locating ? "Finding you…" : "Share your location to sort by distance"}
          </span>
        ) : null}
      </div>

      <SalonGrid businesses={ordered} favouriteIds={favouriteIds} chips={chips} />
    </>
  );
}
