import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking, Payment, Slot } from "../types/booking";
import type { Hairstyle } from "../types/salon";
import { toBooking, toHairstyle, toPayment, toSlot } from "./mappers";

/**
 * Booking reads and writes, ported from the booking section of
 * `tho/app/lib/data/api.dart`.
 *
 * **Every write is an RPC.** `create_booking`, `cancel_booking` and
 * `reschedule_booking` authorise the caller themselves and enforce the guards; the
 * only direct table write here is `booking_attachments`, which the app also writes
 * directly and whose RLS policy allows exactly the booking's own customer.
 */

/** The embeds every booking read shares, so a list and a single row map identically. */
const BOOKING_SELECT =
  "*, businesses(name, address_text, cover_url), staff_members(display_name), " +
  "customer:profiles!bookings_customer_profile_id_fkey(full_name, avatar_url, phone), " +
  "booking_items(service_id, service_name, duration_minutes, price), " +
  "booking_attachments(url)";

/**
 * Bookable slots for one staff member on a range.
 *
 * `compute_availability` takes a fifth argument, `p_slot_step_minutes`, which
 * defaults to 15. It is **not overloaded**, so omitting it is safe — unlike
 * `join_queue`, where two candidates exist and PostgREST cannot choose.
 */
export async function fetchAvailability(
  supabase: SupabaseClient,
  {
    staffId,
    serviceIds,
    from,
    to,
  }: { staffId: string; serviceIds: string[]; from: Date; to: Date },
): Promise<Slot[]> {
  const { data, error } = await supabase.rpc("compute_availability", {
    p_staff_member_id: staffId,
    p_service_ids: serviceIds,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toSlot);
}

/**
 * Create a booking.
 *
 * **The idempotency key is the caller's to own.** `create_booking` catches its own
 * unique violation and returns the booking that key already made, so a retry with the
 * *same* key is safe and a retry with a *fresh* key is a second booking. Generate one
 * per confirm attempt and hold it across retries — see `useIdempotencyKey`.
 */
export async function createBooking(
  supabase: SupabaseClient,
  {
    idempotencyKey,
    businessId,
    staffId,
    serviceIds,
    start,
    customerNote,
  }: {
    idempotencyKey: string;
    businessId: string;
    staffId: string;
    serviceIds: string[];
    start: Date;
    customerNote?: string | null;
  },
): Promise<Booking> {
  const { data, error } = await supabase.rpc("create_booking", {
    p_idempotency_key: idempotencyKey,
    p_business_id: businessId,
    p_staff_member_id: staffId,
    p_service_ids: serviceIds,
    p_start_ts: start.toISOString(),
    p_source: "app",
    p_customer_profile_id: null,
    p_customer_note: customerNote ?? null,
    p_customer_name: null,
    p_customer_phone: null,
  });
  if (error) throw error;
  return toBooking(data as Record<string, unknown>);
}

export async function cancelBooking(
  supabase: SupabaseClient,
  bookingId: string,
  reason = "customer cancelled",
): Promise<void> {
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_reason: reason,
  });
  if (error) throw error;
}

/**
 * Move a booking to a new time, same staff and services.
 *
 * `reschedule_booking` has a third parameter, `p_new_staff_member_id`, which defaults
 * to null (keep the current staff). Passed explicitly rather than omitted, so the
 * intent is on the page instead of in a default someone has to go and look up.
 */
export async function rescheduleBooking(
  supabase: SupabaseClient,
  bookingId: string,
  newStart: Date,
): Promise<Booking> {
  const { data, error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: bookingId,
    p_new_start_ts: newStart.toISOString(),
    p_new_staff_member_id: null,
  });
  if (error) throw error;
  return toBooking(data as Record<string, unknown>);
}

/** The caller's own bookings, newest first. RLS scopes the rows. */
export async function fetchMyBookings(supabase: SupabaseClient): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .order("start_ts", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toBooking);
}

export async function fetchBookingById(
  supabase: SupabaseClient,
  id: string,
): Promise<Booking | null> {
  const { data } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? toBooking(data as unknown as Record<string, unknown>) : null;
}

export async function fetchBookingPayments(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<Payment[]> {
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map(toPayment);
}

/* --------------------------------------------------------------------------
   Reference photos — the PRIVATE `booking-media` bucket.
   -------------------------------------------------------------------------- */

/**
 * Upload one reference photo and return its **object path**, not a URL.
 *
 * Storage RLS requires the first path segment to be the caller's own uid, and reads
 * go through short-lived signed URLs. These photos can identify a person, so the
 * bucket is never world-readable — handing a public URL around would defeat that.
 */
export async function uploadBookingPhoto(
  supabase: SupabaseClient,
  blob: Blob,
  contentType = "image/jpeg",
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign-in required to attach a photo.");

  const objectPath = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("booking-media")
    .upload(objectPath, blob, { contentType, upsert: true });
  if (error) throw error;
  return objectPath;
}

/** One-hour signed URLs for private booking-media paths. */
export async function signedBookingMediaUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from("booking-media")
    .createSignedUrls(paths, 3600);
  if (error) throw error;
  return (data ?? [])
    .map((entry) => entry.signedUrl)
    .filter((url): url is string => Boolean(url));
}

/** Best-effort cleanup of photos uploaded for a booking that never happened. */
export async function deleteBookingPhotos(
  supabase: SupabaseClient,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from("booking-media").remove(paths);
  } catch {
    // Orphan cleanup. Never surfaced — the customer's booking already succeeded.
  }
}

/** Attach uploaded photo paths to a booking. Sort order is the pick order. */
export async function addBookingAttachments(
  supabase: SupabaseClient,
  bookingId: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.from("booking_attachments").insert(
    paths.map((path, sort) => ({ booking_id: bookingId, url: path, sort })),
  );
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   Hairstyles — the Pro-plan booking extra.
   -------------------------------------------------------------------------- */

/**
 * The style catalogue, optionally narrowed to a service's audience so a men's cut
 * doesn't offer updos. A null-gender style suits everyone and is always included —
 * the same "missing data is not an exclusion" rule as the service gender filter.
 */
export async function fetchHairstyles(
  supabase: SupabaseClient,
  gender?: string | null,
): Promise<Hairstyle[]> {
  let query = supabase.from("hairstyles").select("*").eq("is_active", true);
  if (gender) query = query.or(`gender.is.null,gender.eq.${gender}`);
  const { data } = await query.order("name", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map(toHairstyle);
}

/** Best-effort: the booking already exists and the style is a preference. */
export async function setBookingHairstyle(
  supabase: SupabaseClient,
  bookingId: string,
  hairstyleId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("set_booking_hairstyle", {
    p_booking: bookingId,
    p_hairstyle: hairstyleId,
  });
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   Reviews.
   -------------------------------------------------------------------------- */

/** Bookings the caller has already reviewed, so the action can be hidden. */
export async function fetchMyReviewedBookingIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data } = await supabase.from("reviews").select("booking_id");
  return new Set(
    (data ?? [])
      .map((r) => r.booking_id as string | null)
      .filter((id): id is string => id != null),
  );
}

/**
 * Write a review and its photos in one call.
 *
 * `create_review_with_photos` is SECURITY **INVOKER**, which is deliberate: the
 * `reviews_insert` RLS policy stays the authority on who may review what, rather than
 * a definer function re-implementing it.
 */
export async function createReviewWithPhotos(
  supabase: SupabaseClient,
  {
    bookingId,
    businessId,
    staffMemberId,
    rating,
    body,
    photoUrls,
  }: {
    bookingId: string;
    businessId: string;
    staffMemberId?: string | null;
    rating: number;
    body?: string | null;
    photoUrls?: string[];
  },
): Promise<void> {
  const { error } = await supabase.rpc("create_review_with_photos", {
    p_booking: bookingId,
    p_business: businessId,
    p_staff: staffMemberId ?? null,
    p_rating: rating,
    p_body: body?.trim() ? body.trim() : null,
    p_photo_urls: photoUrls ?? [],
  });
  if (error) throw error;
}

/**
 * Upload a review photo to the **public** `media` bucket and return its URL.
 *
 * Different bucket from a booking's reference photos, and deliberately so: a review
 * photo is published beside the review for everyone to see, whereas a reference photo
 * is a private instruction to one stylist.
 */
export async function uploadReviewPhoto(
  supabase: SupabaseClient,
  bookingId: string,
  index: number,
  blob: Blob,
  contentType = "image/jpeg",
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign-in required to add a photo.");

  // Storage RLS requires the caller's uid as the first segment.
  const objectPath = `${user.id}/reviews/${bookingId}-${index}.jpg`;
  const { error } = await supabase.storage
    .from("media")
    .upload(objectPath, blob, { contentType, upsert: true });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(objectPath);
  // Cache-bust so re-uploading to the same path shows immediately.
  return `${publicUrl}?v=${Date.now()}`;
}
