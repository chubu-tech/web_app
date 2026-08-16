import type { Metadata } from "next";
import Link from "next/link";
import { AllSalonsList } from "@/components/customer/all-salons-list";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchBusinesses } from "@/lib/api/discovery";
import { fetchMyFavouriteIds } from "@/lib/api/favourites";
import { SALON_SORTS, type SalonSort } from "@/lib/recommendations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  /*
    "All salons" named the page and not the query. This route is the country-level list
    that `/salons/thimphu` and its siblings hang off, so its title claims the country-level
    search — and the canonical is what keeps `?sort=nearest` and `?sort=topRated` from
    competing with it as two more copies of one document.
  */
  title: "Salons & Barbershops in Bhutan — Book Online",
  description:
    "Every salon and barbershop on THO across Bhutan. Compare services, prices, ratings and opening hours, then book an appointment online or join a walk-in queue. Free for customers.",
  alternates: { canonical: "/salons" },
  openGraph: {
    type: "website",
    url: "/salons",
    title: "Salons & Barbershops in Bhutan — Book Online",
    description:
      "Every salon and barbershop on THO across Bhutan. Compare prices and ratings, then book online or join a walk-in queue.",
  },
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
        <h1 className="text-display-xl text-ink font-semibold">
          Salons and barbers in Bhutan
        </h1>
        <p className="text-body-md text-body mt-xs max-w-[52rem]">
          {businesses.length === 1
            ? "One salon is listed on THO in Bhutan. Open it to see its services, prices, opening hours and reviews, then book online or join its walk-in queue."
            : `${businesses.length} salons and barbershops are listed on THO across Bhutan. Compare services, prices and ratings, then book an appointment online or join a shop's walk-in queue. Booking is free — you pay the salon in the shop.`}
        </p>
      </div>

      {/*
        An `h2` between the page title and the cards.

        Every card's name is an `h3` (`BusinessCard`), so with only an `h1` above them the
        outline jumped `h1` straight to `h3` — a level skipped on four list pages at once.
        This is not a filler heading: it states the count, which is the one fact a list
        page owes a reader before they start scrolling it.
      */}
      <h2 className="text-display-md text-ink mb-md font-semibold">
        {businesses.length === 1 ? "1 salon" : `All ${businesses.length} salons`}
      </h2>

      <AllSalonsList
        businesses={businesses}
        favouriteIds={[...favouriteIds]}
        initialSort={initialSort}
      />
    </div>
  );
}
