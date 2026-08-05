import type { Metadata } from "next";
import Link from "next/link";
import { FavouriteButton } from "@/components/customer/favourite-button";
import { BusinessCard } from "@/components/ui/business-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchMyFavourites } from "@/lib/api/favourites";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved salons" };

/**
 * Saved salons — the app's drawer "Saved salons" screen.
 *
 * Included in 2a because the heart on every card has to lead somewhere. It needs no
 * sign-in wall: with no session `favorites` simply returns nothing, and saving one
 * creates the guest session lazily (see `FavouriteButton`). Because an upgrade keeps
 * the same user id, a guest's list survives signing up.
 */
export default async function SavedPage() {
  const supabase = await createClient();
  const salons = await fetchMyFavourites(supabase).catch(() => []);

  return (
    // Uncapped, and the grid auto-fills above 1440 — the same treatment Discover gets,
    // because this is the same salon-card grid and the two must not disagree about how
    // wide a salon card is.
    <div className="px-base py-lg w-full tablet:px-lg">
      <h1 className="text-display-lg text-ink font-medium">Saved salons</h1>

      {salons.length === 0 ? (
        <EmptyState
          icon={Icons.favourite}
          title="Nothing saved yet"
          message="Tap the heart on a salon and it will show up here."
          action={
            <Link
              href="/"
              className="border-hairline text-title text-ink hover:bg-surface-soft inline-flex min-h-12 items-center rounded-sm border px-4 font-medium"
            >
              Browse salons
            </Link>
          }
        />
      ) : (
        /* The same track Discover's grid uses, and with no filter rail to pay for it
           this is where the brief's counts land exactly: 1 card below 768, 2 from 768,
           4 at 1280, 6 at 1920. `sizes` is `BusinessCard`'s own default, which is
           written for this track. */
        <ul className="gap-lg mt-lg grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))]">
          {salons.map((b, i) => (
            <li
              key={b.id}
              className="motion-safe:animate-card-in"
              style={{ "--i": i, animationDelay: "calc(var(--i) * 45ms)" } as React.CSSProperties}
            >
              <BusinessCard
                id={b.id}
                name={b.name}
                subtitle={b.addressText ?? b.description}
                imageUrl={b.coverUrl}
                avgRating={b.avgRating}
                reviewCount={b.reviewCount}
                favourite={
                  <FavouriteButton businessId={b.id} name={b.name} initial />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
