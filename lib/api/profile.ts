import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reading and editing your own profile, ported from `Api.myProfile` /
 * `Api.updateProfile` (`tho/app/lib/data/api.dart:118-127`).
 *
 * **A direct table write, because there is no RPC to route through.** No
 * `update_my_profile` exists in any migration, so `profiles` joins `favorites`,
 * `follows`, `conversations` and `messages` as a table this app writes directly —
 * and `profiles_update` (`id = (select auth.uid())`) is the authority, exactly as
 * `messages_insert` is for a message.
 *
 * **The column list is a whitelist, and it stays one even though the database now
 * enforces it too.** `20260804000002_profiles_updatable_columns` in `../tho` revoked
 * the table-wide UPDATE grant and handed back only these four columns, because until
 * then any signed-in user could `set role = 'admin'` and unlock all 21 `admin_*`
 * RPCs. The narrow object here is cheap, and a caller reading this file should be
 * able to see what it may write without going to the schema for it.
 */

export type MyProfile = {
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  /** UI-routing hint only. Real authorization is table-derived server-side. */
  role: string;
};

export async function fetchMyProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<MyProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    fullName: (data.full_name as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    role: (data.role as string | null) ?? "customer",
  };
}

/**
 * Save any of name, phone or avatar. Only the fields passed are sent.
 *
 * **`phone` is editable here and is not in the app**, and it is not cosmetic: the
 * notification worker's claim query reads `p.phone` as the **SMS destination**
 * (`20260715000009_notifications_outbox.sql:162`), and every row in the outbox
 * currently fails with *"no deliverable channel (no device token or phone)"*. Two of
 * the 17 live profiles have one, both from the seed, and the app offers no way to set
 * it.
 *
 * Two honest limits, neither of which any copy may paper over:
 *
 * - **The sync is one-way.** `handle_user_phone_update` copies `auth.users.phone`
 *   *into* `profiles.phone` and never the reverse, so a number saved here is not an
 *   auth identity and cannot be signed in with. If phone OTP is ever switched on
 *   (`Api.sendOtp` is dormant), an OTP login would overwrite this value.
 * - **Nothing sends an SMS yet.** There is no gateway. Saving a number makes a future
 *   delivery possible; it does not make one happen, and the UI says so.
 */
export async function updateMyProfile(
  supabase: SupabaseClient,
  userId: string,
  fields: { fullName?: string | null; phone?: string | null; avatarUrl?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.fullName !== undefined) patch.full_name = fields.fullName;
  if (fields.phone !== undefined) patch.phone = fields.phone;
  if (fields.avatarUrl !== undefined) patch.avatar_url = fields.avatarUrl;

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

/**
 * Upload an avatar to the public `media` bucket and return its URL.
 *
 * **The caller's uid must be the first path segment.** `media_auth_insert` requires it
 * (`(storage.foldername(name))[1] = auth.uid()`), so any other layout is refused —
 * including the layout the seed itself used (`avatar/<uid>.jpg`), which only worked
 * because the seed ran as the service role.
 *
 * **A fresh path per upload rather than `upsert`.** Building this found that *every*
 * upload to `media` was failing for any non-service-role user, in the app as well as
 * here: `20260720000001` dropped the bucket's SELECT policy to stop enumeration, and
 * both `upsert: true` (which becomes an `insert … on conflict do update`, permitted only
 * when the conflicting row is selectable) and `remove()` (which resolves prefixes under
 * RLS first) silently need it. `20260804000003_media_own_object_select` in `../tho`
 * restores a SELECT scoped to the caller's own folder, which fixes both without
 * reopening enumeration.
 *
 * A unique path is kept anyway, because it is better than an upsert regardless: it is its
 * own cache key, so nothing needs a `?v=` cache-buster, and no write ever races another.
 *
 * Already inside `next.config.ts`'s allow-list: the public URL is under
 * `/storage/v1/object/public/media/…`.
 */
export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  blob: Blob,
  contentType = "image/jpeg",
  /** The URL currently on the profile, so the object it replaces can be removed. */
  previousUrl?: string | null,
): Promise<string> {
  const objectPath = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("media")
    .upload(objectPath, blob, { contentType });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(objectPath);

  // Best effort, and only after the new object exists — losing the old file matters far
  // less than failing the upload. Skipped unless the path is inside the caller's own
  // folder: the seed's `avatar/<uid>.jpg` layout is not, and `media_auth_delete` would
  // refuse it, so there is no point asking.
  const previous = mediaObjectPath(previousUrl);
  if (previous && previous !== objectPath && previous.startsWith(`${userId}/`)) {
    const { error: removeError } = await supabase.storage.from("media").remove([previous]);
    // Swallowed on purpose: an orphaned object is untidy, not a failure the person who
    // just changed their photo needs to hear about.
    void removeError;
  }

  return publicUrl;
}

/**
 * The object path inside the `media` bucket for one of its public URLs, or null when the
 * URL is not one — an external seed image, an empty column, or the pre-2e
 * `avatar/<uid>.jpg` layout with its `?v=` cache-buster.
 */
function mediaObjectPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/media/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  return decodeURIComponent(url.slice(at + marker.length).split("?")[0]!);
}
