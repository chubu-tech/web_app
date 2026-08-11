import { distanceKm } from "./booking-guards";
import { hasLocation, type Business } from "./types/salon";

/**
 * Pure distance helpers for the client-side distance filter, ported from
 * `tho/app/lib/customer/discover_logic.dart`.
 *
 * Filtering happens on the client because there is no PostGIS, and the
 * coordinates are already in hand once the salon list returns.
 *
 * The Dart original sets `Distance(roundResult: false)`, which is load-bearing
 * rather than a preference: latlong2 rounds in the *target* unit, so the default
 * returns whole kilometres and everything downstream breaks quietly — every
 * salon inside 500 m renders "0.0 km", `nearestSalons` sorts on two or three tie
 * buckets that an unstable sort then orders arbitrarily, and `withinDistance`
 * with `maxKm: 1` admits a salon 1.49 km away. Our `distanceKm` never rounds, so
 * reuse it rather than writing a second implementation.
 */

export type Coords = { lat: number; lng: number };

/**
 * Straight-line km from `from` to a salon. **Null when the salon has no
 * coordinates — unknown, not zero.** Every caller has to keep that distinction.
 */
export function kmTo(b: Business, from: Coords): number | null {
  if (!hasLocation(b)) return null;
  return distanceKm(from, { lat: b.lat, lng: b.lng });
}

/**
 * Salons between `minKm` and `maxKm` of `from`, both bounds inclusive. A salon
 * with no coordinates is dropped: unknown distance is not "within range".
 *
 * `minKm` exists because the filter control is a two-thumb *range* — "10 to
 * 20 km" has a near side as well as a far one. It defaults to no lower bound;
 * see `minDistanceKm` in `salon-filters.ts` for when a caller supplies one.
 */
export function withinDistance(
  all: Business[],
  { from, maxKm, minKm = 0 }: { from: Coords; maxKm: number; minKm?: number },
): Business[] {
  return all.filter((b) => {
    const km = kmTo(b, from);
    return km != null && km >= minKm && km <= maxKm;
  });
}

/**
 * The `limit` salons nearest to `from`, ascending by distance.
 * Coordinate-less salons are omitted rather than sorted arbitrarily.
 */
export function nearestSalons(
  all: Business[],
  { from, limit = 5 }: { from: Coords; limit?: number },
): { business: Business; km: number }[] {
  const withKm: { business: Business; km: number }[] = [];
  for (const business of all) {
    const km = kmTo(business, from);
    if (km != null) withKm.push({ business, km });
  }
  withKm.sort((a, b) => a.km - b.km);
  return withKm.slice(0, limit);
}

/** One decimal, matching the app's `NearbyRow.formatKm`. */
export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}
