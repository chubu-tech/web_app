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
import { fetchProducts } from "@/lib/api/shop";
import { homeForRole } from "@/lib/auth";
import { priceBounds, productFilterFromParams } from "@/lib/product-filter";
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
 * **Products are a segment of this page, not a route.** `?tab=products` swaps the salon list for
 * the cross-salon catalogue and the two share this page's search box — the app's own arrangement
 * (THO-51), and `components/customer/destinations.ts` deliberately declares no Products destination.
 * The catalogue is fetched here on every visit rather than behind the segment: it is one small query
 * against an RLS-filtered table, and paying for it up front means switching segments is instant and
 * needs no loading state.
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

  const tab = one("tab") === "products" ? "products" : "salons";

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

  const [
    businesses,
    categories,
    hoursByBusiness,
    categoriesByBusiness,
    offers,
    favouriteIds,
    products,
  ] = await Promise.all([
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
      // `products_select_public` requires the salon to be on growth or pro, so RLS already limits
      // this to salons that actually sell — nothing here filters by plan. Decorative in the sense
      // that the salon list must survive it failing.
      fetchProducts(supabase).catch(() => []),
    ]);

  // Reconciled against the loaded bounds here rather than in the component: a bound that does not
  // narrow the catalogue is stored as cleared, so a stale or hand-edited URL cannot show an active
  // filter badge over an unfiltered list.
  const productFilter = productFilterFromParams(
    { sort: one("sort"), min: one("min"), max: one("max") },
    priceBounds(products),
  );

  return (
    <Discover
      businesses={businesses}
      categories={categories}
      hoursByBusiness={hoursByBusiness}
      categoriesByBusiness={categoriesByBusiness}
      offers={offers}
      favouriteIds={[...favouriteIds]}
      filters={filters}
      products={products}
      productFilter={productFilter}
      tab={tab}
    />
  );
}
