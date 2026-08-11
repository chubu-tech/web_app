import type { Metadata } from "next";
import Link from "next/link";
import { RecommendedList } from "@/components/customer/recommended-list";
import { Icons, IconSize } from "@/components/ui/icons";
import {
  fetchAllBusinessCategories,
  fetchAllBusinessHours,
  fetchBusinesses,
} from "@/lib/api/discovery";
import { fetchMyFavouriteIds } from "@/lib/api/favourites";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Recommended for you",
  description: "Every salon on Tho, ordered by distance, reviews, availability and your history.",
};

/**
 * Recommended, in full — the "View all" behind Discover's first row, and a port of
 * `recommended_screen.dart`.
 *
 * **The reads are here; the ranking is in the browser.** This page fetches exactly what
 * `rank()` scores against — the salons, every salon's opening hours in one round trip, the
 * category map and the viewer's favourites — and `RecommendedList` does the arithmetic, because
 * a third of the score is distance and a GPS fix does not exist on a server. See that component.
 *
 * The three reads are the same three Discover makes, and deliberately so: two surfaces ranking
 * the same salons from *different* inputs would order them differently under one heading.
 *
 * **Every approved salon, with no filters applied.** Discover's row ranks whatever its filters
 * left, so a filtered browse and this page can hold different sets — which is why the blurb says
 * "every salon" rather than "more of these". Carrying the filter params through would make the
 * link stateful for no gain: somebody who has narrowed to one category is looking at that
 * category, not asking for a second ranked view of it.
 */
export default async function RecommendedPage() {
  const supabase = await createClient();

  const [businesses, hoursByBusiness, categoriesByBusiness, favouriteIds] =
    await Promise.all([
      fetchBusinesses(supabase, { sort: "name" }),
      // One query for the whole list, not one per salon: the availability term needs every
      // salon's week, and this is the read Discover already pays for.
      fetchAllBusinessHours(supabase),
      fetchAllBusinessCategories(supabase),
      // Empty for a visitor, which is the common case and scores as a clean cold start —
      // `historyScore` returns 0 rather than penalising anyone.
      fetchMyFavouriteIds(supabase).catch(() => new Set<string>()),
    ]);

  return (
    <div className="px-base py-lg tablet:px-lg w-full">
      <div className="mb-lg">
        <Link
          href="/discover"
          className="text-caption text-muted hover:text-ink gap-xs mb-sm inline-flex items-center font-medium"
        >
          <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
          Discover
        </Link>
        <h1 className="text-display-xl text-ink font-semibold">Recommended for you</h1>
        <p className="text-body-md text-body mt-xs">
          Every salon, ordered by how close it is, how it is rated, whether it is open and
          where you have been before.
        </p>
      </div>

      <RecommendedList
        businesses={businesses}
        hoursByBusiness={hoursByBusiness}
        categoriesByBusiness={categoriesByBusiness}
        favouriteIds={[...favouriteIds]}
      />
    </div>
  );
}
