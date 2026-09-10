import type { Metadata } from "next";
import { MapView } from "@/components/customer/map-view";
import { fetchBusinesses, fetchCategories } from "@/lib/api/discovery";
import { fromParams, hasPrice, serviceGenders } from "@/lib/salon-filters";
import { createClient } from "@/lib/supabase/server";
import { shareCard } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Salon Map — Find Salons Near You in Bhutan",
  description:
    "See salons and barbershops across Bhutan on a map and find the ones nearest you. Open a shop to compare services and prices, then book online or join its walk-in queue.",
  keywords: [
    "salons near me Bhutan",
    "salon map Bhutan",
    "barbershops in Bhutan",
    "salons nearest you",
  ],
  alternates: { canonical: "/map" },
  ...shareCard({
    url: "/map",
    title: "Salon Map — Find Salons Near You in Bhutan",
    description:
      "Salons and barbershops across Bhutan on a map, with the nearest to you first.",
  }),
};

/**
 * The Map tab, a port of `MapTab` (`tho/app/lib/customer/map_tab.dart`).
 *
 * The salon list is fetched on the server, as everywhere else: `businesses_select`
 * covers `anon`, so a visitor with no session gets the full map, which is what a
 * shared link or a search result has to land on.
 *
 * **11 of the 13 live salons have coordinates.** The other two are on Discover and
 * absent here, which is what "Salons appear on the map once they add a location" is
 * for — `MapView` filters with `hasLocation` rather than the page, so the empty-state
 * decision is made where the search is.
 *
 * The height is fixed rather than flexed. `main` in the customer shell is a flex child
 * of a `min-h-full` column, and a leaflet container needs a definite height to size its
 * panes, so this subtracts the chrome directly.
 *
 * **One subtraction, at every width, from a token.** It used to be two expressions with
 * two different literals — `62px` for the phone tab bar below 744 and `64px` for the
 * sticky top nav above it — plus a safe-area term for the bar's inset. With the bottom
 * bar gone there is exactly one piece of chrome above this page and nothing below it, so
 * the arithmetic collapses to the header's own height. `--header-height` is a token
 * rather than a literal because that literal used to appear in eight files, and getting
 * one of them wrong is invisible until somebody opens that page at 390px.
 *
 * The one known cost is unchanged: while `InLineBar` is on screen the page scrolls by
 * that bar's height. Measuring chrome at runtime to avoid ~48px of scroll on one route,
 * for a bar that only appears while a place is held, is still the worse trade.
 */
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /*
    **The map now takes Discover's filters, through the same model and the same URL
    parameters.** It had search and nothing else, so a customer who narrowed to "Women ·
    under Nu 800" on Discover and switched to the map silently got everything back.

    The split is Discover's, for Discover's reasons: category, gender and price are joins
    and narrow in SQL; rating is an aggregate and distance has no PostGIS behind it, so
    both are applied in the client against the list that returns. `canonical` stays `/map`
    above, so a filtered view is shareable without minting an indexable URL per combination.
  */
  const raw = await searchParams;
  const one = (key: string) => {
    const v = raw[key];
    return Array.isArray(v) ? v[0] : v;
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
  const [salons, categories] = await Promise.all([
    fetchBusinesses(supabase, {
      categoryId: filters.categoryId,
      sort: filters.minRating != null ? "rating" : "name",
      serviceGenders: serviceGenders(filters),
      minPrice: hasPrice(filters) ? filters.price.start : null,
      maxPrice: hasPrice(filters) ? filters.price.end : null,
    }),
    // The panel's category chips. A failed read costs the chips and nothing else — the
    // panel renders "No categories yet", which is also the honest empty case.
    fetchCategories(supabase).catch(() => []),
  ]);

  return (
    <div className="h-[calc(100svh-var(--header-height))]">
      <h1 className="sr-only">Map</h1>
      <MapView salons={salons} categories={categories} filters={filters} />
    </div>
  );
}
