import type { Metadata } from "next";
import Link from "next/link";
import { AllSalonsList } from "@/components/customer/all-salons-list";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchBusinesses } from "@/lib/api/discovery";
import { fetchMyFavouriteIds } from "@/lib/api/favourites";
import { SALON_SORTS, type SalonSort } from "@/lib/recommendations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "All salons",
  description: "Every salon and barbershop on Tho in Bhutan — sort by distance or rating.",
};

/**
 * Every salon on the platform — a port of `all_salons_screen.dart`, reached from Discover's
 * "See all salons".
 *
 * **This replaces an expand-in-place grid**, which is why it is worth a route rather than
 * more local state. Discover used to hold "All salons" as a carousel with a "View all N"
 * that swapped it for a grid in component state: the full list was never linkable, never
 * shareable, never in the back-button history, and offered **no sort at all** where the app
 * has two. The carousel stays as the row; this is what its See-all now points at.
 *
 * The ordering is client-side and so is the page body — see `AllSalonsList` for why (one of
 * the two sorts needs a GPS fix). What the server does is the read, which is the expensive
 * part and needs no browser.
 */
export default async function AllSalonsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const supabase = await createClient();

  const [businesses, favouriteIds] = await Promise.all([
    // Rating order from the server, which is the ordering it is indexed for. It is also the
    // right default for the pre-fix render: `sortedBy(…, "nearest")` with no fix returns the
    // input untouched, so a customer who has not shared a location sees a sensible list
    // rather than an arbitrary one.
    fetchBusinesses(supabase, { sort: "rating" }),
    fetchMyFavouriteIds(supabase).catch(() => new Set<string>()),
  ]);

  /*
    `?sort=` is user-supplied, so it is validated against the union rather than cast into it.
    Same rule as `safeNext` and `salon-filters.ts`'s `fromParams`: a hand-typed value falls
    back to the default instead of reaching a switch that has no case for it. `topRated` is
    the default because it is the one ordering that always works.
  */
  const initialSort: SalonSort = SALON_SORTS.includes(sort as SalonSort)
    ? (sort as SalonSort)
    : "topRated";

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
        <h1 className="text-display-xl text-ink font-semibold">All salons</h1>
        <p className="text-body-md text-body mt-xs">
          {businesses.length === 1
            ? "One salon on Tho."
            : `Every salon on Tho — ${businesses.length} of them.`}
        </p>
      </div>

      <AllSalonsList
        businesses={businesses}
        favouriteIds={[...favouriteIds]}
        initialSort={initialSort}
      />
    </div>
  );
}
