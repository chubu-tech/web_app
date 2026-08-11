import type { Metadata } from "next";
import Link from "next/link";
import { FavouriteButton } from "@/components/customer/favourite-button";
import { BusinessCard } from "@/components/ui/business-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchMyFavourites } from "@/lib/api/favourites";
import { createClient } from "@/lib/supabase/server";
import { cardMetaLine } from "@/lib/types/salon";

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
  /*
    **No catch, and this one needed the reader fixed as well as the page.**

    `.catch(() => [])` here was dead code twice over: `fetchMyFavourites` destructured only
    `data` and dropped `error`, so it could not reject, and a failed read already rendered as
    *"Nothing saved yet — tap the heart on a salon and it will show up here"*. That is the
    third time this repo has found a silent RLS or grant failure hiding behind a dropped
    `error` (the `payments` receipt and the `businesses` anon grant were the others), and the
    only reason it was invisible is that the same shape is also the correct answer for somebody
    who has genuinely saved nothing.

    The reader now surfaces its error and this lets it through to the boundary. **The sign-in
    wall six sibling routes have is deliberately still absent**: a *guest* can hold favourites —
    `favorites_insert` requires no `is_real_user()` and an upgrade keeps the same user id — so
    gating on `registered` would hide a list somebody actually has.
  */
  const salons = await fetchMyFavourites(supabase);

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
                meta={cardMetaLine(b)}
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
