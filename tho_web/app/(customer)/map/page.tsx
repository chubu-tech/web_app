import type { Metadata } from "next";
import { MapView } from "@/components/customer/map-view";
import { fetchBusinesses } from "@/lib/api/discovery";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Map",
  description: "Find salons and barbers near you on the map.",
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
export default async function MapPage() {
  const supabase = await createClient();
  const salons = await fetchBusinesses(supabase);

  return (
    <div className="h-[calc(100svh-var(--header-height))]">
      <h1 className="sr-only">Map</h1>
      <MapView salons={salons} />
    </div>
  );
}
