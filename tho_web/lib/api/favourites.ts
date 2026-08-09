import type { SupabaseClient } from "@supabase/supabase-js";
import type { Business } from "../types/salon";
import { BUSINESS_PUBLIC_SELECT } from "./discovery";
import { toBusiness, withRating } from "./mappers";

/**
 * Favourites, ported from `tho/app/lib/data/api.dart`.
 *
 * Saving a salon is one of the two writes a **guest** is deliberately allowed
 * (following a stylist is the other — see `./staff.ts`). Everything that commits a
 * guest to something — booking, queueing, ordering, messaging — is refused by
 * `private.is_real_user()`, but saving is left open on purpose: it is what makes
 * upgrading worth doing, and because a guest upgrade keeps the same user id, what
 * they saved survives.
 *
 * `favorites` and `follows` were also the first direct table writes here. Chat added
 * two more in 2d and `profiles` a fifth in 2e; everything else goes through an RPC.
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
  // The same projection the public reads use, not `businesses(*)`. This one never broke
  // — `favorites_select` needs a session and a guest session is still the `authenticated`
  // role, which holds table-level SELECT — but an embedded star has the identical failure
  // waiting in it the moment another column is withheld, and `/saved` renders
  // `BusinessCard`, which reads none of the withheld three. See `BUSINESS_PUBLIC_SELECT`.
  const { data } = await supabase
    .from("favorites")
    .select(`businesses(${BUSINESS_PUBLIC_SELECT})`)
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

// The stylist-follow functions used to live here and **could not work** — they sent
// `profile_id` where `follows` has `follower_profile_id`, and read
// `follower_count` where the view has `followers`. Nothing called them, so nothing
// caught it. They now live in `./staff.ts`, corrected, beside the page that uses
// them.
