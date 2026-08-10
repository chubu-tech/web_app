"use client";

import { BusinessCard } from "@/components/ui/business-card";
import { formatKm } from "@/lib/discover-logic";
import { cardMetaLine, type Business } from "@/lib/types/salon";
import { FavouriteButton } from "./favourite-button";

/**
 * A grid of salon cards, with the heart working — the body of `/recommended`, `/top-rated`
 * and anything else that is "a list of salons and nothing else".
 *
 * A client component for one reason: `FavouriteButton` is one, and every card needs its own.
 * The **cards** would render happily on the server; the hearts would not.
 *
 * `chip` and `distanceLabel` are per-card and index-aligned by id rather than positional, so a
 * caller that sorts differently from the order it computed its labels in cannot mislabel a row.
 *
 * The column track is `/saved`'s, not Discover's: neither of these routes has a filter rail, so
 * they get the full width and hit the brief's column counts exactly where Discover lands one
 * short. Same `minmax(268px,1fr)` floor, so a card is never narrower here than it is there.
 */
export function SalonGrid({
  businesses,
  favouriteIds,
  chips,
  distanceKm,
}: {
  businesses: Business[];
  favouriteIds: string[];
  /** Per-salon badge over the cover — the ranking reason, the rating. Keyed by business id. */
  chips?: Record<string, React.ReactNode>;
  /**
   * Straight-line km per salon, when a fix has resolved and the salon has coordinates.
   *
   * Absent means **unknown**, not zero — 2 of the live salons have no location at all — and the
   * card renders no chip for it, which is the same distinction `kmTo` returns null for.
   */
  distanceKm?: Record<string, number>;
}) {
  const favourites = new Set(favouriteIds);

  return (
    <ul className="gap-lg grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))]">
      {businesses.map((b, i) => (
        <li
          key={b.id}
          className="motion-safe:animate-card-in"
          style={{ "--i": i, animationDelay: "calc(var(--i) * 45ms)" } as React.CSSProperties}
        >
          <BusinessCard
            id={b.id}
            name={b.name}
            subtitle={b.addressText ?? b.description}
            meta={cardMetaLine(b)}
            imageUrl={b.coverUrl}
            avgRating={b.avgRating}
            reviewCount={b.reviewCount}
            distanceLabel={
              distanceKm?.[b.id] != null ? formatKm(distanceKm[b.id]!) : null
            }
            chip={chips?.[b.id]}
            // The first card is the largest contentful paint on a page that is nothing but
            // cards, so it is preloaded rather than lazily discovered after layout.
            priority={i === 0}
            favourite={
              <FavouriteButton
                businessId={b.id}
                name={b.name}
                initial={favourites.has(b.id)}
              />
            }
          />
        </li>
      ))}
    </ul>
  );
}
