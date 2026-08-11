import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Discover } from "@/components/customer/discover";
import { StaffInvitePrompt } from "@/components/customer/staff-invite-prompt";
import { fetchMyStaffInvites } from "@/lib/api/staff-invites";
import {
  fetchAllBusinessCategories,
  fetchAllBusinessHours,
  fetchBusinesses,
  fetchCategories,
  fetchSalonsAvailableToday,
} from "@/lib/api/discovery";
import { fetchMyBookings } from "@/lib/api/booking";
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

/**
 * **The canonical is the whole point of this block**, and this page needs one more than
 * any other in the app: the URL *is* the filter state, so `?gender=`, `?category=`,
 * `?price=`, `?q=`, `?tab=products` and every combination of them is a distinct URL over
 * substantially the same content. That is the textbook duplicate-content shape, and
 * without a canonical those variants compete with each other and dilute the one page
 * that should rank for "book a salon in Bhutan".
 *
 * Pointing it at bare `/` is deliberate and is the right call *because* the filters are
 * server-side: every variant is a subset of this page's own list, not a different
 * document. `metadataBase` in the root layout is what makes it absolute.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};
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
    staffInvites,
    availability,
    pastBookings,
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
      /*
        Invitations to a chair, addressed to whoever is signed in.

        Here because `/` is where a bare sign-in lands a customer, which is exactly where
        `auth_gate.dart:132` shows the app's prompt — and it is the **only** way a
        web-only account can become a stylist now that instant linking is gone. The RPC
        already filters to pending, unexpired and still-unlinked, and it refuses an
        anonymous caller, so the `catch` covers a visitor rather than an error.
      */
      fetchMyStaffInvites(supabase).catch(() => []),
      /*
        What every salon can offer for the rest of today, in one round trip.

        Decorative in the strict sense: `salons_available_today` is revoked from `anon`, so a
        signed-out visitor gets a rejection here on **every** load and the catch is the normal
        path, not the exceptional one. The row is then absent rather than empty, which is the
        honest rendering of "we cannot tell you".
      */
      fetchSalonsAvailableToday(supabase).catch(() => []),
      /*
        The customer's own history, for "Book again".

        The user id is **passed in**, not left to RLS: `bookings_select` OR-matches
        `is_business_member`, so an unfiltered read hands a salon member their salons'
        bookings. That is the repeated bug this repo has now fixed six times, and it would be
        especially bad here — a "Book again" row offering an owner their customers'
        appointments.

        `account.user` is null for a visitor and for a guest with no session, and neither has
        a history, so the read is skipped rather than sent and failed.
      */
      account.user
        ? fetchMyBookings(supabase, account.user.id).catch(() => [])
        : Promise.resolve([]),
    ]);

  // Reconciled against the loaded bounds here rather than in the component: a bound that does not
  // narrow the catalogue is stored as cleared, so a stale or hand-edited URL cannot show an active
  // filter badge over an unfiltered list.
  const productFilter = productFilterFromParams(
    { sort: one("sort"), min: one("min"), max: one("max") },
    priceBounds(products),
  );

  return (
    <>
      {/* Above the browse, because it is about this person rather than about salons —
          and because accepting replaces the very shell they are looking at. */}
      {staffInvites.length > 0 ? (
        <div className="px-base pt-lg tablet:px-lg mx-auto w-full max-w-[1128px]">
          <StaffInvitePrompt invites={staffInvites} />
        </div>
      ) : null}

      <Discover
        businesses={businesses}
        categories={categories}
        hoursByBusiness={hoursByBusiness}
        categoriesByBusiness={categoriesByBusiness}
        offers={offers}
        availability={availability}
        pastBookings={pastBookings}
        favouriteIds={[...favouriteIds]}
        filters={filters}
        products={products}
        productFilter={productFilter}
        tab={tab}
      />
    </>
  );
}
