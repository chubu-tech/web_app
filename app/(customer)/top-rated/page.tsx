import type { Metadata } from "next";
import Link from "next/link";
import { SalonGrid } from "@/components/customer/salon-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { MediaChip } from "@/components/ui/business-card";
import { fetchBusinesses } from "@/lib/api/discovery";
import { fetchMyFavouriteIds } from "@/lib/api/favourites";
import { createClient } from "@/lib/supabase/server";
import { topRated } from "@/lib/recommendations";

export const metadata: Metadata = {
  title: "Top rated salons",
  description: "Every rated salon in Bhutan on Tho, best first.",
};

/**
 * Top rated, in full — the "View all" behind Discover's row, and a port of
 * `top_rated_screen.dart`.
 *
 * **Server-rendered, where `/recommended` cannot be.** `topRated` is a pure sort on a column the
 * query already returns, so there is nothing here that needs a browser: no GPS, no favourites
 * arithmetic, no clock. That makes this page indexable and complete in its first paint, which
 * matters — "best salons in Thimphu" is a query a marketplace should own.
 *
 * ## The same sort as the row, unbounded
 *
 * `topRated(businesses)` with no limit rather than a *different* rule. Discover's row calls the
 * same function with the default 5, so this really is more of those salons in that order — which
 * is what `discover-rows.tsx` said no link could honestly promise while this route did not exist.
 * Its comment is now updated rather than merely outvoted.
 *
 * **There is no rating floor**, deliberately, because the function has none: it filters to
 * `avgRating != null` and sorts. A "top rated" page that quietly dropped everything under 4★
 * would be a different list under the same heading, and with 9 of 17 salons rated at all it would
 * be a very short one.
 */
export default async function TopRatedPage() {
  const supabase = await createClient();

  const [businesses, favouriteIds] = await Promise.all([
    // `sort: "rating"` so the server does the ordering it is already indexed for; `topRated`
    // then filters the unrated out and breaks ties on name, which is what makes the order
    // deterministic rather than merely descending.
    fetchBusinesses(supabase, { sort: "rating" }),
    fetchMyFavouriteIds(supabase).catch(() => new Set<string>()),
  ]);

  const rated = topRated(businesses, businesses.length);

  const chips = Object.fromEntries(
    rated.map((b) => [
      b.id,
      <MediaChip key={b.id}>
        <Icons.star
          className="text-star shrink-0 fill-current"
          style={{ width: IconSize.xxs, height: IconSize.xxs }}
          aria-hidden
        />
        {b.avgRating?.toFixed(1)}
      </MediaChip>,
    ]),
  );

  return (
    <div className="px-base py-lg tablet:px-lg w-full">
      <Header
        title="Top rated salons"
        blurb={
          rated.length > 0
            ? `Every salon with reviews, best first — ${rated.length} of them.`
            : "Every salon with reviews, best first."
        }
      />

      {rated.length === 0 ? (
        <EmptyState
          icon={Icons.star}
          title="No ratings yet"
          message="As customers leave reviews, the best-rated salons will appear here."
          action={
            <Link
              href="/discover"
              className="border-hairline text-title text-ink hover:bg-surface-soft px-lg inline-flex min-h-12 items-center rounded-full border font-medium"
            >
              Browse all salons
            </Link>
          }
        />
      ) : (
        <SalonGrid businesses={rated} favouriteIds={[...favouriteIds]} chips={chips} />
      )}
    </div>
  );
}

/** Shared with `/recommended`, kept local to each page — two lines is not a component. */
function Header({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mb-lg">
      <Link
        href="/discover"
        className="text-caption text-muted hover:text-ink gap-xs mb-sm inline-flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        Discover
      </Link>
      <h1 className="text-display-xl text-ink font-semibold">{title}</h1>
      <p className="text-body-md text-body mt-xs">{blurb}</p>
    </div>
  );
}
