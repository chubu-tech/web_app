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
 * of a `min-h-full` column, and a leaflet container needs a definite height to size
 * its panes, so this subtracts the chrome directly: below 744 the fixed tab bar (whose
 * space `main` already reserves with padding), above it the sticky top nav. The one
 * known cost is that while `InLineBar` is on screen the page scrolls by that bar's
 * height — measuring chrome at runtime to avoid ~48px of scroll on one route, for a
 * bar that only appears while a place is held, is the worse trade.
 */
export default async function MapPage() {
  const supabase = await createClient();
  const salons = await fetchBusinesses(supabase);

  return (
    <div className="h-[calc(100svh-62px-env(safe-area-inset-bottom))] tablet:h-[calc(100svh-64px)]">
      <h1 className="sr-only">Map</h1>
      <MapView salons={salons} />
    </div>
  );
}
