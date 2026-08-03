import type { SupabaseClient } from "@supabase/supabase-js";
import type { Business } from "../types/salon";
import { toBusiness, withRating } from "./mappers";

/**
 * Favourites and stylist follows, ported from `tho/app/lib/data/api.dart`.
 *
 * These are the two writes a **guest** is deliberately allowed. Everything that
 * commits a guest to something — booking, queueing, ordering, messaging — is
 * refused by `private.is_real_user()`, but saving a salon is left open on
 * purpose: it is what makes upgrading worth doing, and because a guest upgrade
 * keeps the same user id, what they saved survives.
 *
 * They are also the only direct table writes in the app. Everything else goes
 * through an RPC.
 */

export async function fetchMyFavouriteIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data } = await supabase.from("favorites").select("business_id");
  return new Set((data ?? []).map((r) => r.business_id as string));
}

export async function fetchMyFavourites(
  supabase: SupabaseClient,
): Promise<Business[]> {
  const { data } = await supabase
    .from("favorites")
    .select("businesses(*)")
    .order("created_at", { ascending: false });

  // `favorites → businesses` is a to-one FK, so PostgREST returns an object.
  // Without generated DB types supabase-js can't know that and types the embed
  // as an array, so accept either shape rather than trusting one.
  const rows = (data ?? [])
    .map((r) => {
      const embed = (r as { businesses?: unknown }).businesses;
      const row = Array.isArray(embed) ? embed[0] : embed;
      return (row ?? null) as Record<string, unknown> | null;
    })
    .filter((b): b is Record<string, unknown> => b != null);

  const list = rows.map(toBusiness);
  if (list.length === 0) return [];

  const { data: ratings } = await supabase
    .from("business_rating_summary")
    .select("*")
    .in("business_id", list.map((b) => b.id));

  const byId = new Map(
    (ratings ?? []).map((r) => [
      r.business_id as string,
      { avg: r.avg_rating == null ? null : Number(r.avg_rating), count: Number(r.review_count ?? 0) },
    ]),
  );

  return list.map((b) => {
    const r = byId.get(b.id);
    return withRating(b, r?.avg ?? null, r?.count ?? 0);
  });
}

/**
 * Save or unsave a salon.
 *
 * Requires a session — call `ensureGuestSession` first. An anonymous session is
 * enough; this is one of the few things a guest may do.
 */
export async function setFavourite(
  supabase: SupabaseClient,
  businessId: string,
  favourite: boolean,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign-in required to save a salon.");

  if (favourite) {
    const { error } = await supabase
      .from("favorites")
      .upsert({ profile_id: user.id, business_id: businessId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("profile_id", user.id)
      .eq("business_id", businessId);
    if (error) throw error;
  }
}

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
      .upsert({ profile_id: user.id, staff_member_id: staffId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("profile_id", user.id)
      .eq("staff_member_id", staffId);
    if (error) throw error;
  }
}

/** Follower count from the `staff_follow_summary` view. */
export async function fetchStaffFollowerCount(
  supabase: SupabaseClient,
  staffId: string,
): Promise<number> {
  const { data } = await supabase
    .from("staff_follow_summary")
    .select("follower_count")
    .eq("staff_member_id", staffId)
    .maybeSingle();
  return Number(data?.follower_count ?? 0);
}
