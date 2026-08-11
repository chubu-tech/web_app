import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BusinessPhoto,
  Offer,
  Product,
  Review,
  ServiceItem,
  StaffMember,
} from "../types/salon";
import {
  toBusinessPhoto,
  toOffer,
  toProduct,
  toReview,
  toServiceItem,
  toStaffMember,
} from "./mappers";

/**
 * Everything the salon page reads, ported from `tho/app/lib/data/api.dart`.
 *
 * All anon-readable: services and staff are visible for live businesses,
 * `reviews_select` is `using (true)`, and photos/offers ride the salon's own
 * visibility. So the whole salon page renders for a visitor with no session.
 */

export async function fetchServices(
  supabase: SupabaseClient,
  businessId: string,
  { activeOnly = true }: { activeOnly?: boolean } = {},
): Promise<ServiceItem[]> {
  let q = supabase
    .from("services")
    .select("*")
    .eq("business_id", businessId)
    .is("deleted_at", null);
  if (activeOnly) q = q.eq("is_active", true);

  const { data } = await q.order("name", { ascending: true });
  return (data ?? []).map((m) => toServiceItem(m as Record<string, unknown>));
}

/**
 * Every column of `staff_members` that **any** client role may read — and the reason this
 * is a list rather than `*` is worse here than it is for `businesses`.
 *
 * Measured against the live database with `has_column_privilege`:
 *
 *   staff_members.commission_pct   anon: false   authenticated: false
 *   staff_members.base_salary_nu   anon: false   authenticated: false
 *
 * **Neither role can read either column**, and `has_table_privilege(…, 'SELECT')` is false
 * on this table for both — so `select *` failed for *everyone*, not only signed-out
 * visitors. That is right: pay is written through `set_staff_pay` (SECURITY DEFINER, Pro
 * only) and read through the `payroll_report` RPC, both of which run as `postgres` where
 * column privileges do not apply. A table read is not a channel for a salary.
 *
 * The two consequences were very different in visibility, which is why this survived:
 *
 * - **Public pages threw.** `/salon/[id]`, `/q/[id]`, `/salon/[id]/book` and
 *   `/queue/[entryId]` surfaced `42501 permission denied for table staff_members`.
 * - **The owner console lied.** `fetchStaff` destructures only `data` and drops `error`,
 *   so a refused read became `[]`: `/business/settings` said *"Nobody on the team yet"*
 *   and `/business/staff` an empty roster, on nine salons that each have **two active
 *   stylists** — verified by SQL, not by the page. `/business/staff/[id]` was worse
 *   still: an empty roster means `roster.find()` misses and the route answered
 *   `notFound()`, so every stylist's edit page was a 404.
 *
 * **Do not add the pay columns back under a flag.** The first attempt at this fix gave
 * `fetchStaff` a `withPay` option for the editor, which would have moved the 42501 from
 * the public pages onto `/business/staff/[id]` — `authenticated` is refused too, and the
 * privilege check above is what caught it.
 *
 * `toStaffMember` substitutes 0 for both, so `StaffEditor`'s inputs start at 0 rather than
 * at the stored figure. That is a **real limitation, not a fix**: a client cannot read
 * stored pay at all. It costs nothing on live data — `set_staff_pay` refuses any salon
 * that is not `pro` and no salon is, so the editor renders its locked card everywhere —
 * but if a Pro salon ever appears, the prefill needs `payroll_report`, not this read.
 */
export const STAFF_PUBLIC_SELECT =
  "id, business_id, profile_id, display_name, role, is_active, photo_url";

export async function fetchStaff(
  supabase: SupabaseClient,
  businessId: string,
  { activeOnly = true }: { activeOnly?: boolean } = {},
): Promise<StaffMember[]> {
  let q = supabase
    .from("staff_members")
    .select(STAFF_PUBLIC_SELECT)
    .eq("business_id", businessId)
    .is("deleted_at", null);
  if (activeOnly) q = q.eq("is_active", true);

  const { data } = await q.order("display_name", { ascending: true });
  return (data ?? []).map((m) => toStaffMember(m as unknown as Record<string, unknown>));
}

/**
 * Which stylists perform which services, as `serviceId → Set<staffId>`.
 *
 * **This is load-bearing, not a nicety.** `create_booking` and `compute_availability`
 * both require the pair to exist in `service_staff` and raise
 * *"one or more services are invalid, inactive, or not performed by this staff"*
 * otherwise. The salon page offers services and stylists as two independent lists, so
 * without this a customer can build a pair nobody performs and reach a slot grid that
 * can only fail — measured on live data: Norzin lists 5 services and its stylists
 * perform 3 of them, so 2 of 10 pairings were dead ends.
 *
 * Anon-readable (`service_staff_select` covers `anon` for active services), so the
 * salon page can narrow the choice before anyone signs in.
 */
export async function fetchServiceStaff(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from("service_staff")
    .select("service_id, staff_member_id, services!inner(business_id)")
    .eq("services.business_id", businessId);

  const out: Record<string, string[]> = {};
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const serviceId = row.service_id as string;
    (out[serviceId] ??= []).push(row.staff_member_id as string);
  }
  return out;
}

/**
 * The `review_photos` embed both review reads use.
 *
 * **`id` is in it because a photo has to be reportable.** `report_content` identifies a
 * `review_photo` by its own id, so a projection of urls alone gives a strip of
 * photographs with nothing to report them by — and `ReviewPhoto` would then fall back to
 * reporting the whole review. One constant, so the two reads cannot drift into disagreeing
 * about that.
 */
const REVIEW_SELECT = "*, review_photos(id, url, sort)";

/**
 * Reviews with their photos.
 *
 * The `review_photos` embed is what populates `photos`; a plain `*` select
 * yields none, which renders as no thumbnail strip rather than as an error.
 */
export async function fetchReviews(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Review[]> {
  const { data } = await supabase
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((m) => toReview(m as Record<string, unknown>));
}

export async function fetchReviewsForStaff(
  supabase: SupabaseClient,
  staffId: string,
): Promise<Review[]> {
  const { data } = await supabase
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("staff_member_id", staffId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((m) => toReview(m as Record<string, unknown>));
}

export async function fetchBusinessPhotos(
  supabase: SupabaseClient,
  businessId: string,
): Promise<BusinessPhoto[]> {
  const { data } = await supabase
    .from("business_photos")
    .select("id, url")
    .eq("business_id", businessId)
    .order("sort", { ascending: true });
  return (data ?? []).map((m) => toBusinessPhoto(m as Record<string, unknown>));
}

export async function fetchOffersForBusiness(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Offer[]> {
  const { data } = await supabase
    .from("offers")
    .select("*")
    .eq("business_id", businessId)
    .order("ends_on", { ascending: true, nullsFirst: false });
  return (data ?? []).map((m) => toOffer(m as Record<string, unknown>));
}

/**
 * Live offers across every salon, for the home feed. Capped, and joins the salon
 * name because the feed has to say whose offer it is.
 */
export async function fetchLiveOffers(
  supabase: SupabaseClient,
  limit = 12,
): Promise<Offer[]> {
  const { data } = await supabase
    .from("offers")
    .select("*, businesses(name, cover_url)")
    .order("ends_on", { ascending: true, nullsFirst: false })
    .limit(limit);
  return (data ?? []).map((m) => toOffer(m as Record<string, unknown>));
}

export async function fetchProductsForBusiness(
  supabase: SupabaseClient,
  businessId: string,
  { availableOnly = true }: { availableOnly?: boolean } = {},
): Promise<Product[]> {
  let q = supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_archived", false);
  if (availableOnly) q = q.eq("in_stock", true);

  const { data } = await q.order("sort_order", { ascending: true });
  return (data ?? []).map((m) => toProduct(m as Record<string, unknown>));
}
