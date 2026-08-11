import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deleting your own account.
 *
 * ## It is a real deletion, not a deactivation
 *
 * Since `20260806000003_delete_account.sql` the `auth.users` row goes and the email is
 * freed for reuse. There is no support path back and deliberately no "reactivate":
 * Google Play is explicit that freezing an account does not count as deleting it.
 *
 * ## Two error codes that are not failures
 *
 * - **`P0001`** names how many salons the caller still owns and says what to do about it.
 *   An owner cannot delete an account that would orphan a live salon. The RPC's own
 *   sentence is the only useful reply, so it is surfaced verbatim — replacing it with a
 *   generic failure leaves an owner refused with no way forward.
 * - **`P0002`** means there is no live profile left to delete: the account is *already*
 *   gone. That is a success from the caller's point of view, so `deleteAccount` resolves
 *   rather than throwing, and the caller signs out as it would have anyway. Reporting it
 *   as an error would show a failure for something that had already happened.
 *
 * Everything else is a real failure and throws.
 */
export async function deleteAccount(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("delete_account");
  if (!error) return;

  // Already deleted. See above — this is the success path, not an error path.
  if (error.code === "P0002") return;

  throw error;
}

/**
 * The refusal an owner gets, if any, in the server's own words.
 *
 * Returns `null` for anything that is not the "you still own salons" raise, so callers
 * can show the sentence when there is one and a generic line otherwise. Matching on the
 * code rather than the text, as everything else in this repo does.
 */
export function deleteAccountRefusal(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code !== "P0001") return null;
  return typeof e.message === "string" && e.message.trim() ? e.message : null;
}
