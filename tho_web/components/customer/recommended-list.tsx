"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaChip } from "@/components/ui/business-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { resolveLocation, type Fix } from "@/lib/geo";
import { rank } from "@/lib/recommendations";
import type { WorkingHour } from "@/lib/types/booking";
import type { Business } from "@/lib/types/salon";
import { SalonGrid } from "./salon-grid";

/**
 * The complete ranked list — a port of `recommended_screen.dart`, and the reason
 * `/recommended` cannot be a server component.
 *
 * `rank()` needs three things a server render does not have: **a GPS fix** (30% of the score),
 * the viewer's **favourites** (part of the history term), and a **clock** compared in Thimphu
 * wall-clock for the availability term. The fix is the blocking one — it exists only in a
 * browser, behind a permission prompt — so the ranking happens here, exactly as it does on
 * Discover, from data the server handed down.
 *
 * ## It is the same ranking as the row, and that is the whole point of the route
 *
 * `discover-rows.tsx` used to argue that "Recommended for you" could have no "View all" because
 * *"the ranking is computed in this browser from a GPS fix and a favourites set"* — so any link
 * would lead somewhere that ranked differently. That was right, and the answer was not to drop
 * the link but to put the same computation behind it: identical `rank()` call, identical inputs,
 * no `slice`. A salon's position here matches its position in the row.
 *
 * ## It renders before the fix resolves, and re-ranks when it lands
 *
 * `distanceScore` returns a **neutral 0.5** for an unknown distance rather than a penalty, so the
 * pre-fix order is a real ranking on reviews, availability and history — not a placeholder. That
 * is why there is no spinner: the list is useful immediately and improves in place. The location
 * line says which of the two you are looking at, the same way Discover's does.
 */
export function RecommendedList({
  businesses,
  hoursByBusiness,
  categoriesByBusiness,
  favouriteIds,
}: {
  businesses: Business[];
  hoursByBusiness: Record<string, WorkingHour[]>;
  categoriesByBusiness: Record<string, Set<string>>;
  favouriteIds: string[];
}) {
  const [fix, setFix] = useState<Fix | null>(null);
  const location = fix?.coords ?? null;

  // On mount, not lazily behind whichever section reads it first — the mistake
  // `customer_home.dart:304-313` records, where a fix that resolved late left the distance
  // term neutral for the rest of the session.
  useEffect(() => {
    let live = true;
    resolveLocation().then((resolved) => {
      if (live) setFix(resolved);
    });
    return () => {
      live = false;
    };
  }, []);

  const favourites = useMemo(() => new Set(favouriteIds), [favouriteIds]);

  const ranked = useMemo(
    () =>
      rank({
        businesses,
        // Read inside the memo rather than passed in from the server: the availability term is
        // "is it open right now", so a value captured at render time on the server and reused
        // in the browser would age. Discover does the same.
        now: new Date(),
        userLocation: location,
        favoriteIds: favourites,
        hoursByBusiness,
        categoriesByBusiness,
      }),
    [businesses, location, favourites, hoursByBusiness, categoriesByBusiness],
  );

  if (ranked.length === 0) {
    return (
      <EmptyState
        icon={Icons.salon}
        title="No salons yet"
        message="New salons will appear here as they join."
      />
    );
  }

  const chips = Object.fromEntries(
    ranked.map((r) => [r.business.id, <MediaChip key={r.business.id}>{r.reason}</MediaChip>]),
  );

  // `distanceKm` only for salons `kmTo` could actually measure — `rank` returns null for a
  // salon with no coordinates and for every salon before the fix lands.
  const distanceKm = Object.fromEntries(
    ranked
      .filter((r) => r.distanceKm != null)
      .map((r) => [r.business.id, r.distanceKm!]),
  );

  return (
    <>
      <p className="text-caption-sm text-muted mb-base">
        {fix?.source === "gps"
          ? "Ordered for you, using your location."
          : fix?.source === "fallback"
            ? "Ordered for you, with distances from Thimphu."
            : "Ordering for you…"}
      </p>
      <SalonGrid
        businesses={ranked.map((r) => r.business)}
        favouriteIds={favouriteIds}
        chips={chips}
        distanceKm={distanceKm}
      />
    </>
  );
}
