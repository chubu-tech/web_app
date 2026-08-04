import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffMember } from "../types/salon";
import { toStaffMember } from "./mappers";

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

export async function fetchStaffById(
  supabase: SupabaseClient,
  id: string,
): Promise<StaffMember | null> {
  const { data } = await supabase
    .from("staff_members")
    .select("*")
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
