import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking } from "../types/booking";
import type { StaffMember } from "../types/salon";
import { BOOKING_SELECT } from "./booking";
import { toBooking, toStaffMember } from "./mappers";
import { STAFF_PUBLIC_SELECT } from "./salon";

/**
 * The specialist (staff) profile's reads and its one write, ported from
 * `tho/app/lib/data/api.dart:812-856`.
 *
 * All anon-readable, so the page works with no session: `staff_select` covers `anon`
 * for active staff of a live business, `reviews_select` is `using (true)`, and
 * `staff_photos_read` rides the staff member's own visibility. Reviews come from
 * `fetchReviewsForStaff` in `./salon.ts`, which already existed.
 *
 * **Two functions here were written in Phase 1 against the wrong column names and
 * never called, so nothing caught them.** They are the two things this page is for:
 *
 * | Was | Actual |
 * | --- | --- |
 * | `setFollowStaff` sent `profile_id` | `follows.follower_profile_id` |
 * | the count read `follower_count` | `staff_follow_summary.followers` |
 *
 * Both would have failed on first press — the insert with a 42703, the count silently
 * as 0. Fixed here, and the verification presses the button against the live database
 * rather than trusting the shape.
 */

/**
 * The signed-in user's own staff row, or `null` if no owner has linked them yet.
 *
 * A port of `Api.myStaffMember` (`api.dart:812`) including both filters: `profile_id`
 * matches the caller and `is_active` is true. An owner who deactivates a stylist takes
 * their shell away rather than leaving them a stale one, which is why `is_active` is part
 * of the identity read and not a display detail.
 *
 * `null` is an ordinary answer, not an error: `link_staff_member` is the owner's action, so
 * a freshly created staff account has no row to find until they take it. `/staff` draws the
 * app's "Not linked yet" state for exactly this case.
 *
 * **`.limit(1).maybeSingle()`, matching the Dart** — `staff_members` has no unique index on
 * `profile_id`, so one account linked to two salons would return two rows and a bare
 * `maybeSingle()` would throw. The app takes the first; so does this.
 */
export async function fetchMyStaffMember(
  supabase: SupabaseClient,
  userId: string,
): Promise<StaffMember | null> {
  // `STAFF_PUBLIC_SELECT`, not `*`. This is the read the whole staff shell hangs on — a
  // stylist with no `staff_members` row gets `_NotLinked` — and `*` made it return null for
  // *everyone*, because `authenticated` has no table-level SELECT here either. A linked
  // stylist was shown the "no owner has linked you" state. See `STAFF_PUBLIC_SELECT`.
  const { data } = await supabase
    .from("staff_members")
    .select(STAFF_PUBLIC_SELECT)
    .eq("profile_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data ? toStaffMember(data as unknown as Record<string, unknown>) : null;
}

/**
 * One stylist's own appointments, newest first.
 *
 * **The `.eq("staff_member_id", …)` is the scope, not a convenience.** `bookings_select` is
 * `customer_profile_id = auth.uid() OR private.is_business_member(business_id)`, and
 * `is_business_member` admits an active `staff_members.profile_id` — so an unfiltered read
 * hands a linked stylist **every booking in the salon**, including the other stylists' and
 * every customer's name and phone. That is the fourth instance of the OR-policy leak this
 * repo has found (see `fetchMyBookings`, `/bookings/[id]`, `fetchMyConversations`,
 * `fetchMyActiveEntries`), and the fix is the same one every time: pass the id in rather
 * than trusting the policy to be a filter.
 *
 * Ordering matches `Api.myBookings` — descending by start, i.e. newest first, which is the
 * opposite of the calendar's `bookingsForRange`. The segments do the rest of the work.
 */
export async function fetchStaffBookings(
  supabase: SupabaseClient,
  staffMemberId: string,
): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("staff_member_id", staffMemberId)
    .order("start_ts", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toBooking);
}

/**
 * One of this stylist's own appointments, by id.
 *
 * **Two `.eq()`s, and the second one is the whole authorisation.** `bookings_select` admits
 * `private.is_business_member(business_id)`, and a linked stylist is a member of the entire
 * salon — so `.eq("id", …)` alone would open **any** booking in the shop: another stylist's
 * customer, their phone number, their note, with a working Complete and Cancel on it. That is
 * the **sixth** instance of the OR-policy leak in this repo (`fetchMyBookings`,
 * `/bookings/[id]`, `fetchMyConversations`, `fetchMyActiveEntries`, `fetchStaffBookings`), and
 * the fix is the same every time: pass the id in rather than trusting a policy to be a filter.
 *
 * `null` rather than a raise for a booking that is not theirs, so the route can answer
 * `notFound()` — the same refusal `/messages/[id]` and `/business/bookings/[id]` make. A
 * stylist guessing an id learns nothing about whether it exists.
 */
export async function fetchStaffBookingById(
  supabase: SupabaseClient,
  staffMemberId: string,
  bookingId: string,
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", bookingId)
    .eq("staff_member_id", staffMemberId)
    .maybeSingle();
  if (error) throw error;
  return data ? toBooking(data as unknown as Record<string, unknown>) : null;
}

export async function fetchStaffById(
  supabase: SupabaseClient,
  id: string,
): Promise<StaffMember | null> {
  // `/stylist/[id]` is public, so this is the narrow projection — `anon` holds no SELECT
  // on `commission_pct` or `base_salary_nu`, and `*` therefore 42501'd the whole page for
  // signed-out visitors. `toStaffMember` substitutes 0 for both, which is the honest
  // answer on a page that has no business showing either.
  const { data } = await supabase
    .from("staff_members")
    .select(STAFF_PUBLIC_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? toStaffMember(data as Record<string, unknown>) : null;
}

/**
 * A specialist's portfolio photos, in the owner's chosen order.
 *
 * `staff_photos` has **2 rows platform-wide**, so an empty gallery is the normal
 * case and the caller shows the app's empty state rather than an error.
 */
export async function fetchStaffPhotos(
  supabase: SupabaseClient,
  staffId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("staff_photos")
    .select("url")
    .eq("staff_member_id", staffId)
    .order("sort", { ascending: true });
  return (data ?? []).map((r) => r.url as string);
}

/**
 * How many people follow this specialist.
 *
 * **`staff_follow_summary` is a definer view, and that is the only reason this number
 * exists.** It was created without `security_invoker`, so it runs with the view
 * owner's rights and aggregates across all of `follows` — whereas `follows_select` is
 * `follower_profile_id = auth.uid()`, so any RLS-scoped read could only ever count
 * *your own* follow. It is also granted to `anon`, so a signed-out visitor sees the
 * real number: there is no unknown-versus-zero problem here of the kind
 * `queue_active_line` has.
 *
 * Do not read its sibling `business_rating_summary` as equivalent — that one **does**
 * set `security_invoker=true`, and only works because `reviews_select` is public.
 */
export async function fetchStaffFollowerCount(
  supabase: SupabaseClient,
  staffId: string,
): Promise<number> {
  const { data } = await supabase
    .from("staff_follow_summary")
    .select("followers")
    .eq("staff_member_id", staffId)
    .maybeSingle();
  // No row means nobody follows them yet — the view only has rows where a follow does.
  return Number(data?.followers ?? 0);
}

/**
 * Whether the caller follows this specialist. False with no session.
 *
 * Scoped by `follows_select` rather than by an explicit filter, and that is sound
 * here in a way it was not for conversations: this policy matches on the caller
 * alone, with no OR clause that could widen it to someone else's rows.
 */
export async function isFollowingStaff(
  supabase: SupabaseClient,
  staffId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("staff_member_id")
    .eq("staff_member_id", staffId)
    .maybeSingle();
  return data != null;
}

/**
 * Follow or unfollow. Requires a session — call `ensureGuestSession` first.
 *
 * **A guest may do this**, deliberately: `follows_insert` requires only
 * `follower_profile_id = auth.uid()`, with no `private.is_real_user()`, so following
 * sits on the favourites side of the line rather than the booking side. Nobody is
 * committed to anything by it, and because upgrading a guest keeps the same user id,
 * what they followed survives signing up.
 *
 * The primary key is `(follower_profile_id, staff_member_id)`, so an upsert is the
 * idempotent form — pressing Follow twice cannot raise.
 */
export async function setFollowStaff(
  supabase: SupabaseClient,
  staffId: string,
  follow: boolean,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign-in required to follow a stylist.");

  if (follow) {
    const { error } = await supabase
      .from("follows")
      .upsert({ follower_profile_id: user.id, staff_member_id: staffId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_profile_id", user.id)
      .eq("staff_member_id", staffId);
    if (error) throw error;
  }
}
