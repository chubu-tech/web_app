import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The staff-invite handshake — asking someone before making them your stylist.
 *
 * ## This replaces `link_staff_member`, it does not sit beside it
 *
 * `link_staff_member` resolved an email against `auth.users` and **immediately** set
 * `profiles.role = 'staff'` on whoever owned it. An owner who knew (or guessed) an
 * address could therefore convert a stranger's account — replacing their whole shell —
 * with no consent and no notice. Upstream removed it in `ee413c6` ("ask before making
 * someone staff") and `tho_web` was the last caller left.
 *
 * The shape now: the owner **invites**, the invitee **accepts**. Nothing about the
 * invitee's account changes until they act.
 *
 * ## `createStaffInvite` returns one constant answer, and that is deliberate
 *
 * The RPC ends with a comment worth repeating here, because the temptation is in the UI
 * rather than in the SQL:
 *
 * > *one constant answer. Do not add a "we couldn't find that account" branch here,
 * > however much friendlier it reads — that is the oracle.*
 *
 * Distinguishing "invited" from "no such account" turns this form into an
 * account-existence probe for any address an owner cares to type. So the RPC answers
 * `{status: 'sent', email}` whether or not anyone holds that address, and **the web copy
 * must not undo that** by saying "they'll get an email" only in one branch. It says the
 * same thing either way.
 *
 * ## Errors worth mapping rather than swallowing
 *
 * - `22023` — the address failed the RPC's own format check.
 * - `P0001` — either the staff row is gone, or it **already has a linked account**.
 * - `42501` — not the salon's owner.
 *
 * A fresh invite silently revokes any pending one for the same stylist (the RPC does the
 * `update … set status='revoked'` itself), so re-sending is safe and needs no guard here.
 */

export type StaffInvite = {
  id: string;
  businessId: string;
  businessName: string;
  staffMemberId: string;
  staffName: string;
  createdAt: Date;
  expiresAt: Date;
};

/** What the owner sees while an invite is outstanding. */
export type PendingInvite = {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
};

/**
 * Invite an email address to a chair.
 *
 * Resolves whether or not that address belongs to anyone — see above. The caller must
 * not branch on the result.
 */
export async function createStaffInvite(
  supabase: SupabaseClient,
  staffId: string,
  email: string,
): Promise<void> {
  const { error } = await supabase.rpc("create_staff_invite", {
    p_staff_id: staffId,
    p_email: email,
  });
  if (error) throw error;
}

/**
 * The outstanding invite for one stylist, if any.
 *
 * A direct read of `staff_invites` rather than an RPC, because there isn't one for the
 * owner's side — `my_staff_invites` answers the *invitee's* question. `staff_invites`
 * has an owner-scoped SELECT policy, and the filters here are belt to it: only `pending`,
 * and only one that has not lapsed, because an expired row is not something to offer a
 * Revoke button for.
 */
export async function fetchPendingInvite(
  supabase: SupabaseClient,
  staffId: string,
): Promise<PendingInvite | null> {
  const { data } = await supabase
    .from("staff_invites")
    .select("id, email, created_at, expires_at")
    .eq("staff_member_id", staffId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    email: row.email as string,
    createdAt: new Date(row.created_at as string),
    expiresAt: new Date(row.expires_at as string),
  };
}

/** Withdraw an invite the owner sent. */
export async function revokeStaffInvite(
  supabase: SupabaseClient,
  inviteId: string,
): Promise<void> {
  const { error } = await supabase.rpc("revoke_staff_invite", { p_invite: inviteId });
  if (error) throw error;
}

/**
 * Invitations addressed to **me**, from the invitee's side.
 *
 * The RPC does the matching with `private.email_is_mine`, so nothing here needs the
 * caller's address — and it already filters to `pending`, unexpired, and a staff row that
 * is still unlinked. An empty array is the overwhelmingly normal answer.
 */
export async function fetchMyStaffInvites(
  supabase: SupabaseClient,
): Promise<StaffInvite[]> {
  const { data, error } = await supabase.rpc("my_staff_invites");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    businessId: row.business_id as string,
    businessName: (row.business_name as string) ?? "A salon",
    staffMemberId: row.staff_member_id as string,
    staffName: (row.staff_name as string) ?? "",
    createdAt: new Date(row.created_at as string),
    expiresAt: new Date(row.expires_at as string),
  }));
}

/**
 * Accept — the only thing that turns a customer into a stylist.
 *
 * It sets `profiles.role = 'staff'` and links the row, so the caller's next landing is a
 * different shell entirely. Callers must re-resolve routing afterwards rather than
 * assuming the current page still applies.
 */
export async function acceptStaffInvite(
  supabase: SupabaseClient,
  inviteId: string,
): Promise<void> {
  const { error } = await supabase.rpc("accept_staff_invite", { p_invite: inviteId });
  if (error) throw error;
}
