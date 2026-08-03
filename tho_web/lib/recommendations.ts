import { isActiveBooking } from "./calendar-logic";
import { kmTo, type Coords } from "./discover-logic";
import { minutesOfDay, thimphuMinutesOfDay, thimphuWeekday, thimphuDayOf } from "./time";
import type { Booking, WorkingHour } from "./types/booking";
import type { Business } from "./types/salon";

/**
 * The salon recommender, ported from `tho/app/lib/customer/recommendations.dart`.
 *
 * Pure and deterministic — `now` and `userLocation` are injected — so it can be
 * tested without a device or a backend. Given already-loaded data it scores each
 * salon on distance, reviews, availability and the customer's own history, then
 * returns them best-first.
 *
 * ## Two deliberate divergences from the Dart original
 *
 * **1. Distance is never rounded.** The Dart recommender uses `const Distance()`
 * (which rounds to whole km) while `discover_logic.dart` explicitly sets
 * `roundResult: false` and documents at length why rounding is harmful. That
 * inconsistency means the same salon can read "1.0 km" in Recommended and
 * "1.2 km" in Nearby. Here both come from one unrounded `kmTo`. The Dart tests
 * only assert relative ordering, so this preserves their expectations while
 * removing the discrepancy.
 *
 * **2. Availability is computed in Thimphu time, not the viewer's.** The Dart
 * version reads `now.weekday` and `now.hour` from device-local time, justified
 * because "Bhutan is a single timezone so device-local time equals salon-local
 * time". That holds for a phone in Bhutan and **fails on the web**, where a
 * visitor's browser can be in any zone — the whole point of a website. Opening
 * hours are Thimphu wall-clock, so they are compared against Thimphu wall-clock.
 */

export type RecommendationWeights = {
  distance: number;
  reviews: number;
  availability: number;
  history: number;
};

/**
 * Weights need not sum to 1 — only the ratios matter for ordering — but the
 * defaults do, which keeps the composite score readable as a rough 0..1 quality.
 */
export const DEFAULT_WEIGHTS: RecommendationWeights = {
  distance: 0.3,
  reviews: 0.3,
  availability: 0.2,
  history: 0.2,
};

/**
 * Distance decay constant, km. Thimphu is compact, so a salon ~4 km away already
 * scores ~0.37 of one on your doorstep.
 */
export const DISTANCE_SCALE_KM = 4.0;

/**
 * Prior strength for the Bayesian review score — how many "average" reviews a
 * salon is treated as starting with, damping tiny-sample outliers.
 */
export const REVIEW_PRIOR_COUNT = 5.0;

export type RankedSalon = {
  business: Business;
  score: number;
  distanceScore: number;
  reviewScore: number;
  availabilityScore: number;
  historyScore: number;
  /** Straight-line km, or null when either side's position is unknown. */
  distanceKm: number | null;
  /** Short label for the card chip, e.g. "Open now · 1.2 km". */
  reason: string;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Great-circle km, or null when it can't be computed. */
export function kmBetween(b: Business, user: Coords | null): number | null {
  if (user == null) return null;
  return kmTo(b, user);
}

/**
 * Closeness. Exponential decay so near salons dominate without hard cliffs; an
 * unknown distance is **neutral (0.5), not penalised** — a salon that hasn't
 * pinned itself shouldn't be buried for it.
 */
export function distanceScore(km: number | null, scaleKm = DISTANCE_SCALE_KM): number {
  if (km == null) return 0.5;
  return clamp01(Math.exp(-km / scaleKm));
}

/**
 * Bayesian-shrunk rating mapped to 0..1. Blends the salon's own average toward
 * the global mean by `priorCount` pseudo-reviews, so **a single 5★ cannot
 * outrank a well-reviewed 4.6★**. Unrated salons collapse to the global mean.
 */
export function reviewScore(
  b: Pick<Business, "avgRating" | "reviewCount">,
  globalMean: number,
  priorCount = REVIEW_PRIOR_COUNT,
): number {
  const v = b.reviewCount;
  const r = b.avgRating ?? globalMean;
  const bayes = (v * r + priorCount * globalMean) / (v + priorCount);
  return clamp01((bayes - 1) / 4); // 1..5 stars -> 0..1
}

/**
 * Cheap availability proxy from weekly opening hours: open right now scores
 * highest, opening later today next, open-some-other-day lower, and no hours on
 * record stays neutral.
 *
 * Compared in **Thimphu** wall-clock — see the divergence note above.
 */
export function availabilityScoreFromHours(hours: WorkingHour[], now: Date): number {
  if (hours.length === 0) return 0.5;

  const dow = thimphuWeekday(thimphuDayOf(now));
  const nowMinutes = thimphuMinutesOfDay(now);

  let openNow = false;
  let laterToday = false;
  for (const h of hours) {
    if (h.dayOfWeek !== dow) continue;
    const open = minutesOfDay(h.startTime);
    const close = minutesOfDay(h.endTime);
    if (nowMinutes >= open && nowMinutes < close) openNow = true;
    if (nowMinutes < open) laterToday = true;
  }

  if (openNow) return 1.0;
  if (laterToday) return 0.7;
  return 0.35; // closed today but open on other days
}

/** Non-cancelled prior bookings the customer has at this salon. */
export function visitCount(b: Pick<Business, "id">, history: Booking[]): number {
  return history.filter((bk) => bk.businessId === b.id && isActiveBooking(bk)).length;
}

/**
 * Fraction of this salon's categories that appear among the categories the
 * customer books. Zero when either side is empty.
 */
function categoryAffinity(
  b: Pick<Business, "id">,
  history: Booking[],
  categoriesByBusiness: Record<string, Set<string>>,
): number {
  const mine = categoriesByBusiness[b.id];
  if (!mine || mine.size === 0) return 0;

  const preferred = new Set<string>();
  for (const bk of history) {
    if (!bk.businessId) continue;
    for (const c of categoriesByBusiness[bk.businessId] ?? []) preferred.add(c);
  }
  if (preferred.size === 0) return 0;

  let overlap = 0;
  for (const c of mine) if (preferred.has(c)) overlap++;
  return overlap / mine.size;
}

/**
 * Personalisation from the customer's own signals: salons they've booked before
 * (saturating on visit count), salons they've saved, and category affinity.
 * **Zero for a brand-new user** — a clean cold start.
 */
export function historyScore(
  b: Pick<Business, "id">,
  {
    history,
    favoriteIds,
    categoriesByBusiness,
  }: {
    history: Booking[];
    favoriteIds: Set<string>;
    categoriesByBusiness: Record<string, Set<string>>;
  },
): number {
  const visits = visitCount(b, history);
  const visitBoost = visits === 0 ? 0 : 1 - Math.exp(-visits / 2);
  const fav = favoriteIds.has(b.id) ? 1 : 0;
  const affinity = categoryAffinity(b, history, categoriesByBusiness);
  return clamp01(0.5 * visitBoost + 0.35 * fav + 0.25 * affinity);
}

/** The card chip, in priority order. */
function reasonFor({
  business,
  km,
  availability,
  favorite,
  visited,
}: {
  business: Business;
  km: number | null;
  availability: number;
  favorite: boolean;
  visited: boolean;
}): string {
  if (visited) return "You've visited";
  if (favorite) return "Saved";

  const parts: string[] = [];
  if (availability >= 1) parts.push("Open now");
  if (km != null) parts.push(`${km.toFixed(km < 10 ? 1 : 0)} km`);
  if (parts.length > 0) return parts.join(" · ");

  if ((business.avgRating ?? 0) >= 4.5) return "Highly rated";
  return "Recommended";
}

/**
 * Score and sort salons best-first. Ratings are expected to be already merged
 * onto the rows, as the discovery query does.
 *
 * Ties break on name, so the order is deterministic — which is what makes the
 * output testable.
 */
export function rank({
  businesses,
  now,
  userLocation = null,
  history = [],
  favoriteIds = new Set<string>(),
  hoursByBusiness = {},
  categoriesByBusiness = {},
  weights = DEFAULT_WEIGHTS,
}: {
  businesses: Business[];
  now: Date;
  userLocation?: Coords | null;
  history?: Booking[];
  favoriteIds?: Set<string>;
  hoursByBusiness?: Record<string, WorkingHour[]>;
  categoriesByBusiness?: Record<string, Set<string>>;
  weights?: RecommendationWeights;
}): RankedSalon[] {
  const rated = businesses.filter((b) => b.avgRating != null);
  const globalMean =
    rated.length === 0
      ? 3.0
      : rated.reduce((sum, b) => sum + (b.avgRating ?? 0), 0) / rated.length;

  const ranked = businesses.map((business) => {
    const km = kmBetween(business, userLocation);
    const ds = distanceScore(km);
    const rs = reviewScore(business, globalMean);
    const avail = availabilityScoreFromHours(hoursByBusiness[business.id] ?? [], now);
    const hs = historyScore(business, { history, favoriteIds, categoriesByBusiness });

    return {
      business,
      score:
        weights.distance * ds +
        weights.reviews * rs +
        weights.availability * avail +
        weights.history * hs,
      distanceScore: ds,
      reviewScore: rs,
      availabilityScore: avail,
      historyScore: hs,
      distanceKm: km,
      reason: reasonFor({
        business,
        km,
        availability: avail,
        favorite: favoriteIds.has(business.id),
        visited: visitCount(business, history) > 0,
      }),
    };
  });

  ranked.sort(
    (a, b) => b.score - a.score || a.business.name.localeCompare(b.business.name),
  );
  return ranked;
}

/** Top-rated, the way the app's `TopRatedRow` does it: rated salons only. */
export function topRated(businesses: Business[], limit = 5): Business[] {
  return businesses
    .filter((b) => b.avgRating != null)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
