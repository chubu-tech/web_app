import type { SupabaseClient } from "@supabase/supabase-js";
import type { Business, Category, SalonAvailability } from "../types/salon";
import type { WorkingHour } from "../types/booking";
import {
  toBusiness,
  toBusinessHour,
  toCategory,
  toSalonAvailability,
  withRating,
} from "./mappers";

/**
 * Discovery reads, ported from `Api.businesses` and friends in
 * `tho/app/lib/data/api.dart`.
 *
 * All of this is anon-readable: `businesses_select` lets `anon` see approved,
 * active, non-deleted salons, so browsing needs no session.
 */

/**
 * The columns a **public** read of `businesses` may name — and it is a list rather than
 * `*` for a reason that took the whole signed-out site down.
 *
 * `anon` does not hold table-level SELECT on `businesses`; it holds it per column, and
 * three columns are withheld: `monthly_revenue_goal`, `reviewed_by` and
 * `rejection_reason`. That is **correct** — a salon's revenue target and an operator's
 * reason for rejecting it are not public — but `select *` demands SELECT on *every*
 * column, so a single withheld one made every anonymous read of this table fail with
 *
 *   42501  permission denied for table businesses
 *   hint:  Grant the required privileges to the current role with:
 *          GRANT SELECT ON public.businesses TO anon;
 *
 * The hint is what makes this expensive to diagnose: it reads as "nothing is granted"
 * when in fact almost everything is. `select=id,name` returns 200 against the same
 * table in the same request. **Do not act on that hint** — granting those columns to
 * `anon` would publish every salon's revenue goal to the open web.
 *
 * `authenticated` still holds the table-level privilege, which is why this only ever
 * broke signed-out visitors — Discover, `/map`, `/salon/[id]`, `/q/[id]`, the booking
 * page and `/stylist/[id]`, i.e. every page a search result or a printed QR code lands
 * on. Signed in, all of it worked, which is the worst possible failure signature.
 *
 * `monthly_revenue_goal` is deliberately absent here rather than fetched and dropped:
 * `toBusiness` maps it through `numOrNull`, so it arrives `null`, and the only reader is
 * the owner console's settings form — which resolves its salon through
 * `fetchMyBusinesses` (`./owner.ts`), a read that runs as `authenticated` and still
 * names `*`. Keep it that way; the owner needs the column and is entitled to it.
 *
 * Ordering and filtering are unaffected: PostgREST lets you filter and sort on a column
 * you can read but did not project, and `anon` can read `status`, `deleted_at` and
 * `is_active` perfectly well.
 */
export const BUSINESS_PUBLIC_SELECT =
  "id, name, description, address_text, phone, cover_url, timezone, " +
  "cancellation_window_hours, is_active, lat, lng, plan, business_type, " +
  "service_radius_km, whatsapp_phone, queue_enabled, queue_join_mode, " +
  "reminder_channel, rebooking_enabled, rebooking_days";

export type SalonSort = "name" | "rating";

export type BusinessQuery = {
  categoryId?: string | null;
  sort?: SalonSort;
  /** From the gender filter; unisex is always included by the caller. */
  serviceGenders?: string[] | null;
  minPrice?: number | null;
  maxPrice?: number | null;
};

/**
 * Ratings for a set of salons, from the `business_rating_summary` view.
 * Scoped to the ids shown rather than the whole table.
 */
async function ratingsFor(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { avg: number | null; count: number }>> {
  const out = new Map<string, { avg: number | null; count: number }>();
  if (ids.length === 0) return out;

  const { data } = await supabase
    .from("business_rating_summary")
    .select("*")
    .in("business_id", ids);

  for (const r of data ?? []) {
    out.set(r.business_id as string, {
      avg: r.avg_rating == null ? null : Number(r.avg_rating),
      count: Number(r.review_count ?? 0),
    });
  }
  return out;
}

/**
 * Discover salons, optionally narrowed by category and by their services'
 * gender/price, with aggregate ratings merged in.
 *
 * Two things here are not incidental:
 *
 * 1. **The services filter is an inner join, so rows multiply** — one per
 *    matching service. De-duplicate *before* merging ratings, keeping first-seen
 *    order so the `name` sort survives.
 * 2. **`sort: 'rating'` is applied client-side**, because the rating lives in a
 *    view that isn't part of the query. Unrated salons sort last (`-1`), not
 *    first, which is what treating null as 0 would do.
 */
export async function fetchBusinesses(
  supabase: SupabaseClient,
  { categoryId = null, sort = "name", serviceGenders = null, minPrice = null, maxPrice = null }: BusinessQuery = {},
): Promise<Business[]> {
  const byService = serviceGenders != null || minPrice != null || maxPrice != null;

  const select = [
    // Not `*` — see `BUSINESS_PUBLIC_SELECT`. An embedded join does not rescue it
    // either: `*, services!inner(...)` still expands the star over the parent table.
    BUSINESS_PUBLIC_SELECT,
    categoryId != null ? "business_categories!inner(category_id)" : null,
    byService ? "services!inner(gender, price)" : null,
  ]
    .filter(Boolean)
    .join(", ");

  let query = supabase.from("businesses").select(select);

  if (categoryId != null) {
    query = query.eq("business_categories.category_id", categoryId);
  }
  if (byService) {
    query = query.eq("services.is_active", true);
    if (serviceGenders != null) {
      // A service with no recorded gender counts as "might suit", not "excluded".
      //
      // The Dart original uses a plain `in`, and SQL `IN` never matches NULL —
      // which matters because **24 of 31 live services have `gender = null`**.
      // Filtering strictly drops 8 of the 10 salons that have any services at
      // all, not because they don't serve women or men but because nobody filled
      // the field in. Measured against live data: "women" returns 2 salons
      // strictly and 10 inclusively.
      //
      // Treating unspecified as eligible also matches the product's own logic,
      // which already decided unisex counts for everyone. Price bounds still
      // narrow normally, so this is not a filter that matches everything.
      query = query.or(
        `gender.is.null,gender.in.(${serviceGenders.join(",")})`,
        { referencedTable: "services" },
      );
    }
    if (minPrice != null) query = query.gte("services.price", minPrice);
    if (maxPrice != null) query = query.lte("services.price", maxPrice);
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) throw error;

  // The select string is built at runtime, so supabase-js can't infer the row
  // shape and falls back to `GenericStringError`. Widen through `unknown`.
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  let list = rows.map(toBusiness);

  // An inner join returns one row per matching service, so a salon with several
  // qualifying services would repeat. Keep first-seen, which is `name` order.
  if (byService) {
    const seen = new Set<string>();
    list = list.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
  }

  const ratings = await ratingsFor(supabase, list.map((b) => b.id));
  list = list.map((b) => {
    const r = ratings.get(b.id);
    return withRating(b, r?.avg ?? null, r?.count ?? 0);
  });

  if (sort === "rating") {
    list.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
  }
  return list;
}

export async function fetchBusinessById(
  supabase: SupabaseClient,
  id: string,
): Promise<Business | null> {
  // `BUSINESS_PUBLIC_SELECT`, not `*`: every caller of this is a customer route that an
  // anonymous visitor can reach — `/salon/[id]`, `/q/[id]`, `/salon/[id]/book`,
  // `/stylist/[id]`, `/bookings/[id]` and the cart.
  const { data } = await supabase
    .from("businesses")
    .select(BUSINESS_PUBLIC_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const ratings = await ratingsFor(supabase, [id]);
  const r = ratings.get(id);
  // Widened through `unknown` for the same reason `fetchBusinesses` does it above: the
  // select is a const rather than an inline literal, so supabase-js's string parser cannot
  // infer the row and types `data` as `GenericStringError`.
  return withRating(
    toBusiness(data as unknown as Record<string, unknown>),
    r?.avg ?? null,
    r?.count ?? 0,
  );
}

export async function fetchCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("sort", { ascending: true });
  return (data ?? []).map((m) => toCategory(m as Record<string, unknown>));
}

/**
 * Weekly opening hours for every salon, grouped by id — one round trip.
 *
 * The recommender needs hours for the whole list to score availability, so
 * fetching per salon would be N round trips on the Discover screen.
 */
export async function fetchAllBusinessHours(
  supabase: SupabaseClient,
): Promise<Record<string, WorkingHour[]>> {
  const { data } = await supabase
    .from("business_hours")
    .select("id, business_id, day_of_week, open_time, close_time");

  const out: Record<string, WorkingHour[]> = {};
  for (const row of data ?? []) {
    const id = row.business_id as string;
    (out[id] ??= []).push(toBusinessHour(row as Record<string, unknown>));
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return out;
}

export async function fetchBusinessHours(
  supabase: SupabaseClient,
  businessId: string,
): Promise<WorkingHour[]> {
  const { data } = await supabase
    .from("business_hours")
    .select("id, business_id, day_of_week, open_time, close_time")
    .eq("business_id", businessId)
    .order("day_of_week", { ascending: true });
  return (data ?? []).map((m) => toBusinessHour(m as Record<string, unknown>));
}

/** Category ids per salon, for the recommender's category affinity. */
export async function fetchAllBusinessCategories(
  supabase: SupabaseClient,
): Promise<Record<string, Set<string>>> {
  const { data } = await supabase
    .from("business_categories")
    .select("business_id, category_id");

  const out: Record<string, Set<string>> = {};
  for (const row of data ?? []) {
    const id = row.business_id as string;
    (out[id] ??= new Set()).add(row.category_id as string);
  }
  return out;
}

export async function fetchBusinessCategoryIds(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("business_categories")
    .select("category_id")
    .eq("business_id", businessId);
  return new Set((data ?? []).map((r) => r.category_id as string));
}

/**
 * What every discoverable salon can offer for the rest of today — one round trip.
 *
 * `salons_available_today` (`20260808000001`, secured by `20260808000002`) takes **no
 * arguments**: the server already knows the date, the timezone and which salons are
 * discoverable. It calls `compute_availability` internally rather than reimplementing
 * availability, so the slot it reports is the slot the booking flow will actually offer.
 *
 * **`authenticated` only** — `revoke execute … from public, anon`. So this returns nothing
 * for a signed-out visitor and the row that renders it is correctly absent for them, which
 * is a different thing from the row being broken. Callers should treat a rejection as "no
 * answer" rather than surfacing it.
 *
 * The N+1 it replaces is why `Api.earliestSlotsFor` was never ported: the app used to do a
 * services read, a staff read, and one `compute_availability` **per stylist per salon**.
 */
export async function fetchSalonsAvailableToday(
  supabase: SupabaseClient,
): Promise<SalonAvailability[]> {
  const { data, error } = await supabase.rpc("salons_available_today");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toSalonAvailability);
}
