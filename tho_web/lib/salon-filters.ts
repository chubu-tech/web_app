/**
 * Discovery filter state, ported from `SalonFilters` in
 * `tho/app/lib/customer/filter_screen.dart`.
 *
 * Gender and price narrow the services join **server-side**; distance is applied
 * **client-side** against the resolved location, because there is no PostGIS.
 *
 * On the web this is also URL state — see `fromParams` / `toParams`, which make a
 * filtered view shareable. The app can't do that, and it's the main thing worth
 * adding rather than merely porting.
 */

export type GenderFilter = "any" | "women" | "men";

/** The distance slider's own bounds. Named so the control and the filter logic
 *  cannot drift apart — `minDistanceKm` tests against the floor. */
export const DISTANCE_MIN_KM = 1;
export const DISTANCE_MAX_KM = 50;
export const PRICE_MIN = 100;
export const PRICE_MAX = 2000;

export type Range = { start: number; end: number };

export const DISTANCE_DEFAULT: Range = { start: DISTANCE_MIN_KM, end: DISTANCE_MAX_KM };
export const PRICE_DEFAULT: Range = { start: PRICE_MIN, end: PRICE_MAX };

export type SalonFilters = {
  gender: GenderFilter;
  categoryId: string | null;
  minRating: number | null;
  distance: Range;
  price: Range;
};

export const EMPTY_FILTERS: SalonFilters = {
  gender: "any",
  categoryId: null,
  minRating: null,
  distance: DISTANCE_DEFAULT,
  price: PRICE_DEFAULT,
};

/** The rating tiers on the Reviews section, each a minimum average. */
export const RATING_TIERS: { label: string; min: number }[] = [
  { label: "4.5 and above", min: 4.5 },
  { label: "4.0 - 4.5", min: 4.0 },
  { label: "3.5 - 4.0", min: 3.5 },
  { label: "3.0 - 3.5", min: 3.0 },
  { label: "2.5 - 3.0", min: 2.5 },
];

const sameRange = (a: Range, b: Range) => a.start === b.start && a.end === b.end;

export const hasGender = (f: SalonFilters) => f.gender !== "any";
export const hasPrice = (f: SalonFilters) => !sameRange(f.price, PRICE_DEFAULT);
export const hasDistance = (f: SalonFilters) => !sameRange(f.distance, DISTANCE_DEFAULT);

/**
 * The distance range's lower bound as a real minimum, or null when there is
 * nothing to honour.
 *
 * The control is a two-thumb range, so "10 – 20 km" has to mean 10 to 20 —
 * consuming only `.end` still returned the salon 0.5 km away. But
 * `DISTANCE_MIN_KM` is the smallest lower bound the slider can express, so
 * someone who dragged only the *upper* thumb ("anywhere up to 5 km") has not
 * asked to hide the salon next door; reading the floor as a filter would bury
 * exactly the results they most want.
 */
export function minDistanceKm(f: SalonFilters): number | null {
  return f.distance.start > DISTANCE_MIN_KM ? f.distance.start : null;
}

/** True when any control deviates from its default — badges the filter button. */
export function isActive(f: SalonFilters): boolean {
  return (
    hasGender(f) ||
    f.categoryId != null ||
    f.minRating != null ||
    hasDistance(f) ||
    hasPrice(f)
  );
}

/**
 * The `services.gender` values each customer-facing choice admits.
 *
 * **Unisex appears in both lists**, because a unisex service genuinely serves everyone —
 * which is also why there is no Unisex chip anywhere: a third choice would present those
 * services as a separate menu rather than as part of both.
 *
 * A key that is not here (including `any`) means **no constraint**. That is the safe
 * direction: an unrecognised value must show too much, never too little.
 *
 * Exported because two surfaces read it — this file's {@link serviceGenders} for Discover's
 * server-side query, and `filterByGender` in `lib/booking-basket.ts` for the booking flow's
 * service step. They were separate literals until the step was built, which is exactly how
 * Discover's filter and the step would have come to disagree about what "Women" means.
 * `service_filters.dart:23` makes the same point about the same map.
 */
export const GENDER_SERVICE_KINDS: Record<string, readonly string[]> = {
  women: ["female", "unisex"],
  men: ["male", "unisex"],
};

/**
 * The service genders satisfying the gender filter, or null for no constraint.
 */
export function serviceGenders(f: SalonFilters): string[] | null {
  const kinds = GENDER_SERVICE_KINDS[f.gender];
  return kinds ? [...kinds] : null;
}

/* ---------------------------------------------------------------------------
   URL state — web-only, so a filtered view can be shared.
   --------------------------------------------------------------------------- */

function num(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function fromParams(params: {
  gender?: string;
  category?: string;
  minRating?: string;
  kmMin?: string;
  kmMax?: string;
  priceMin?: string;
  priceMax?: string;
}): SalonFilters {
  const gender: GenderFilter =
    params.gender === "women" || params.gender === "men" ? params.gender : "any";

  const clampKm = (n: number) => Math.min(DISTANCE_MAX_KM, Math.max(DISTANCE_MIN_KM, n));
  const clampPrice = (n: number) => Math.min(PRICE_MAX, Math.max(0, n));

  const kmMin = num(params.kmMin);
  const kmMax = num(params.kmMax);
  const priceMin = num(params.priceMin);
  const priceMax = num(params.priceMax);
  const minRating = num(params.minRating);

  return {
    gender,
    categoryId: params.category || null,
    // Only accept a rating that is actually one of the offered tiers, so a
    // hand-edited URL can't invent a filter the UI can't display.
    minRating:
      minRating != null && RATING_TIERS.some((t) => t.min === minRating) ? minRating : null,
    distance: {
      start: kmMin != null ? clampKm(kmMin) : DISTANCE_MIN_KM,
      end: kmMax != null ? clampKm(kmMax) : DISTANCE_MAX_KM,
    },
    price: {
      start: priceMin != null ? clampPrice(priceMin) : PRICE_MIN,
      end: priceMax != null ? clampPrice(priceMax) : PRICE_MAX,
    },
  };
}

/** Only non-default values, so a clean view has a clean URL. */
export function toParams(f: SalonFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (hasGender(f)) out.gender = f.gender;
  if (f.categoryId) out.category = f.categoryId;
  if (f.minRating != null) out.minRating = String(f.minRating);
  if (hasDistance(f)) {
    out.kmMin = String(f.distance.start);
    out.kmMax = String(f.distance.end);
  }
  if (hasPrice(f)) {
    out.priceMin = String(f.price.start);
    out.priceMax = String(f.price.end);
  }
  return out;
}
