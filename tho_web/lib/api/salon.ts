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

export async function fetchStaff(
  supabase: SupabaseClient,
  businessId: string,
  { activeOnly = true }: { activeOnly?: boolean } = {},
): Promise<StaffMember[]> {
  let q = supabase
    .from("staff_members")
    .select("*")
    .eq("business_id", businessId)
    .is("deleted_at", null);
  if (activeOnly) q = q.eq("is_active", true);

  const { data } = await q.order("display_name", { ascending: true });
  return (data ?? []).map((m) => toStaffMember(m as Record<string, unknown>));
}

/**
 * Reviews with their photos.
 *
 * The `review_photos` embed is what populates `photoUrls`; a plain `*` select
 * yields none, which renders as no thumbnail strip rather than as an error.
 */
export async function fetchReviews(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Review[]> {
  const { data } = await supabase
    .from("reviews")
    .select("*, review_photos(url, sort)")
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
    .select("*, review_photos(url, sort)")
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
