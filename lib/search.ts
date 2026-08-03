import type { Salon, SalonIndex } from "./salons";

/**
 * Narrowing and ordering the salon list.
 *
 * Two rules run through all of it:
 *
 * 1. **Never hide a salon for having incomplete data.** Of the live salons, some
 *    have no services rows, no opening hours or no map pin. A filter that
 *    silently drops them would make the site look emptier than the platform is,
 *    and would punish the salon for a blank field. Unknowns are kept and marked,
 *    not excluded.
 * 2. **Only promise what the data supports.** The "when" filter matches salons
 *    that are *open* at that time. It cannot know whether a chair is free —
 *    there is no anon-readable availability search — so nothing here claims to.
 */

export type TimeWindow = "any" | "morning" | "afternoon" | "evening";

/** Minutes from midnight. Mirrors the labels shown in the panel. */
export const TIME_WINDOWS: Record<
  Exclude<TimeWindow, "any">,
  { label: string; hint: string; fromMin: number; toMin: number }
> = {
  morning: { label: "Morning", hint: "9am – 12pm", fromMin: 9 * 60, toMin: 12 * 60 },
  afternoon: { label: "Afternoon", hint: "12pm – 5pm", fromMin: 12 * 60, toMin: 17 * 60 },
  evening: { label: "Evening", hint: "5pm – 9pm", fromMin: 17 * 60, toMin: 21 * 60 },
};

export type Query = {
  /** A category name, or a specific service name, or null for everything. */
  treatment: string | null;
  /** True when `treatment` names a category rather than a single service. */
  treatmentIsCategory: boolean;
  city: string | null;
  /** ISO date (yyyy-mm-dd) or null. */
  date: string | null;
  window: TimeWindow;
};

export const EMPTY_QUERY: Query = {
  treatment: null,
  treatmentIsCategory: false,
  city: null,
  date: null,
  window: "any",
};

export function isQueryEmpty(q: Query): boolean {
  return !q.treatment && !q.city && !q.date && q.window === "any";
}

export type Coords = { lat: number; lng: number };

/** Straight-line kilometres. Good enough to order a list of salons by. */
export function distanceKm(from: Coords, to: Coords): number {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** How a salon met (or didn't fully meet) the query — drives the UI's honesty. */
export type Match = {
  salon: Salon;
  distanceKm: number | null;
  /** True when a filter applied and the salon has no data to judge it on. */
  unverified: boolean;
};

function matchesTreatment(salon: Salon, q: Query): boolean | null {
  if (!q.treatment) return true;
  if (q.treatmentIsCategory) {
    if (salon.categories.length === 0) return null; // nothing to judge on
    return salon.categories.includes(q.treatment);
  }
  if (salon.services.length === 0) return null;
  const wanted = q.treatment.toLowerCase();
  return salon.services.some((s) => s.toLowerCase() === wanted);
}

function matchesWhen(salon: Salon, q: Query): boolean | null {
  if (!q.date && q.window === "any") return true;
  if (salon.hours.length === 0) return null;

  const days = q.date
    ? [new Date(`${q.date}T00:00:00`).getDay()]
    : [0, 1, 2, 3, 4, 5, 6];

  const window = q.window === "any" ? null : TIME_WINDOWS[q.window];

  return salon.hours.some((h) => {
    if (!days.includes(h.day)) return false;
    if (!window) return true;
    // Any overlap between opening hours and the chosen window.
    return h.openMin < window.toMin && h.closeMin > window.fromMin;
  });
}

function matchesCity(salon: Salon, q: Query): boolean | null {
  if (!q.city) return true;
  if (!salon.city) return null;
  return salon.city === q.city;
}

/**
 * Apply the query. Returns confirmed matches first, then salons that could not
 * be judged because a field is blank — never silently dropped.
 */
export function runQuery(
  index: SalonIndex,
  q: Query,
  origin: Coords | null,
): { matches: Match[]; unverified: Match[] } {
  const matches: Match[] = [];
  const unverified: Match[] = [];

  for (const salon of index.salons) {
    const checks = [
      matchesTreatment(salon, q),
      matchesCity(salon, q),
      matchesWhen(salon, q),
    ];

    if (checks.some((c) => c === false)) continue;

    const entry: Match = {
      salon,
      distanceKm:
        origin && salon.lat != null && salon.lng != null
          ? distanceKm(origin, { lat: salon.lat, lng: salon.lng })
          : null,
      unverified: checks.some((c) => c === null),
    };

    (entry.unverified ? unverified : matches).push(entry);
  }

  const order = origin ? byDistance : byRecommended;
  return { matches: matches.sort(order), unverified: unverified.sort(order) };
}

/** Best-regarded first: rating, then how many people rated it, then tier. */
function byRecommended(a: Match, b: Match): number {
  const tier = { pro: 0, growth: 1, basic: 2 } as const;
  return (
    (b.salon.rating ?? 0) - (a.salon.rating ?? 0) ||
    b.salon.reviewCount - a.salon.reviewCount ||
    tier[a.salon.plan] - tier[b.salon.plan] ||
    a.salon.name.localeCompare(b.salon.name)
  );
}

/** Closest first. Salons with no pin sink to the bottom rather than showing 0 km. */
function byDistance(a: Match, b: Match): number {
  if (a.distanceKm == null && b.distanceKm == null) return byRecommended(a, b);
  if (a.distanceKm == null) return 1;
  if (b.distanceKm == null) return -1;
  return a.distanceKm - b.distanceKm;
}

/**
 * What earns a place in "Recommended".
 *
 * A recommendation has to mean something. Sorting every salon by rating and
 * calling the top of the list "recommended" would just be the full directory
 * with a flattering label — so there is a floor (real reviews, and a good
 * score) and a cap (a shortlist, not a listing). Salons that don't clear it are
 * not hidden; they're in "All salons".
 */
export const RECOMMENDED_MIN_RATING = 4;
export const RECOMMENDED_MIN_REVIEWS = 1;
/** One row of the grid — a shortlist reads as a recommendation, 11 does not. */
export const SHORTLIST = 4;

export function recommended(index: SalonIndex, limit = SHORTLIST): Match[] {
  return index.salons
    .filter(
      (s) =>
        s.reviewCount >= RECOMMENDED_MIN_REVIEWS &&
        (s.rating ?? 0) >= RECOMMENDED_MIN_RATING,
    )
    .map((salon) => ({ salon, distanceKm: null, unverified: false }))
    .sort(byRecommended)
    .slice(0, limit);
}

/** Only salons with a pin can be near you — the rest simply don't qualify. */
export function nearby(
  index: SalonIndex,
  origin: Coords,
  limit = SHORTLIST,
): Match[] {
  return index.salons
    .filter((s) => s.lat != null && s.lng != null)
    .map((salon) => ({
      salon,
      distanceKm: distanceKm(origin, { lat: salon.lat!, lng: salon.lng! }),
      unverified: false,
    }))
    .sort(byDistance)
    .slice(0, limit);
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}
