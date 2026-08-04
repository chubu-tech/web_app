import { redirect } from "next/navigation";
import { Discover } from "@/components/customer/discover";
import {
  fetchAllBusinessCategories,
  fetchAllBusinessHours,
  fetchBusinesses,
  fetchCategories,
} from "@/lib/api/discovery";
import { fetchMyFavouriteIds } from "@/lib/api/favourites";
import { fetchLiveOffers } from "@/lib/api/salon";
import { homeForRole } from "@/lib/auth";
import { fromParams, hasPrice, serviceGenders } from "@/lib/salon-filters";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Discover — the customer home.
 *
 * **The URL is the filter state.** Gender, category and price narrow a services
 * join server-side, so they have to be known before the query runs; reading them
 * from `searchParams` means a filtered view is a shareable link, which the Flutter
 * app cannot offer. Distance and the rating floor are applied in the client, where
 * the GPS fix lives.
 *
 * Everything here is anon-readable: `businesses_select` lets `anon` see approved,
 * active salons, so this whole page renders for a visitor with no session — which
 * is what arriving from a search result or a QR scan looks like.
 *
 * **This is the one customer route that turns an owner away**, and only because it is
 * the one an owner is *sent* to: `/` is where a bare sign-in, a bookmark and the root
 * of the site all land. Every other customer route stays open to them on purpose — an
 * owner's own `/salon/<id>` page and their own printed `/q/<id>` QR are pages any
 * anonymous visitor can already read, and bouncing them off those would be a
 * regression with no security value. The nav simply never offers the way in.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Cheap for the common case: `getAccount` returns `anonymous` without touching
  // `profiles` when there is no session, which is most Discover traffic.
  const account = await getAccount();
  if (account.state === "registered") {
    const home = homeForRole(account.role);
    if (home !== "/") redirect(home);
  }

  const raw = await searchParams;
  const one = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const filters = fromParams({
    gender: one("gender"),
    category: one("category"),
    minRating: one("minRating"),
    kmMin: one("kmMin"),
    kmMax: one("kmMax"),
    priceMin: one("priceMin"),
    priceMax: one("priceMax"),
  });

  const supabase = await createClient();

  const [businesses, categories, hoursByBusiness, categoriesByBusiness, offers, favouriteIds] =
    await Promise.all([
      fetchBusinesses(supabase, {
        categoryId: filters.categoryId,
        // Sort by rating when a Reviews filter is active, so top-rated salons lead
        // — the app does the same (`customer_home.dart:389`).
        sort: filters.minRating != null ? "rating" : "name",
        serviceGenders: serviceGenders(filters),
        minPrice: hasPrice(filters) ? filters.price.start : null,
        maxPrice: hasPrice(filters) ? filters.price.end : null,
      }),
      fetchCategories(supabase),
      // The recommender scores availability for the whole list, so hours are
      // fetched in one round trip rather than one per salon.
      fetchAllBusinessHours(supabase),
      fetchAllBusinessCategories(supabase),
      // Decorative: an offers outage must not take the page with it.
      fetchLiveOffers(supabase).catch(() => []),
      // Empty for a visitor with no session, which is the common case.
      fetchMyFavouriteIds(supabase).catch(() => new Set<string>()),
    ]);

  return (
    <Discover
      businesses={businesses}
      categories={categories}
      hoursByBusiness={hoursByBusiness}
      categoriesByBusiness={categoriesByBusiness}
      offers={offers}
      favouriteIds={[...favouriteIds]}
      filters={filters}
    />
  );
}
