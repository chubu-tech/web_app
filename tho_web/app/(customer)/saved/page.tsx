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
    <div className="px-base py-lg mx-auto w-full max-w-[1440px] tablet:px-lg">
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
        <ul className="gap-base mt-lg grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 wide:grid-cols-4">
          {salons.map((b) => (
            <li key={b.id}>
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
