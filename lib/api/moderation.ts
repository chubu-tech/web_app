import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reporting, blocking, and the terms someone has to accept before they can post.
 *
 * All of it landed upstream in `20260807000010`–`20260807000012` and none of it had a web
 * caller, which meant two things on this site: nothing could be reported at all, and a
 * customer's **first** review or **first** message failed with a raw `P0004` because the
 * server now requires accepted terms before it will take user-generated content.
 *
 * The vocabularies below are Postgres enums, not free text. `report_content` casts the
 * strings and raises `22023` on anything it does not recognise, so these unions exist to
 * make a typo a type error instead of a runtime refusal.
 */

/** `public.report_target_type`. */
export type ReportTarget = "review" | "review_photo" | "business_photo" | "message" | "user";

/** `public.report_reason`, in the order the enum declares them. */
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "misinformation",
  "personal_info",
  "impersonation",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * One reportable thing, as a value.
 *
 * Exists so a **server** component can hand a client one down a prop: a photo strip needs
 * a target per thumbnail, and `(index) => target` cannot cross the boundary. An
 * index-aligned array of these can, and it keeps the *resolution* — which id belongs to
 * which photo, and what to do when there isn't one — in the page that did the reads.
 */
export type ReportRef = {
  target: ReportTarget;
  targetId: string;
  /** What it is called in the sheet's heading: "this review", "this photo". */
  label: string;
};

/** What each reason is called on screen. The enum labels are not sentences. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or a scam",
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  sexual: "Sexual content",
  violence: "Violence or threats",
  misinformation: "False information",
  personal_info: "Someone's private information",
  impersonation: "Pretending to be someone else",
  other: "Something else",
};

export type BlockedUser = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  blockedAt: Date;
};

/**
 * File a report.
 *
 * The note is capped at 1000 characters by the RPC. Three refusals are worth knowing:
 * `42501` for a guest (reporting needs a real account), `22023` for an unknown target,
 * reason, over-long note or reporting yourself, and `P0002` when the thing being reported
 * has already gone.
 */
export async function reportContent(
  supabase: SupabaseClient,
  input: {
    target: ReportTarget;
    targetId: string;
    reason: ReportReason;
    note?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.rpc("report_content", {
    p_target_type: input.target,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_note: input.note?.trim() ? input.note.trim() : null,
  });
  if (error) throw error;
}

export async function blockUser(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.rpc("block_user", { p_user: userId });
  if (error) throw error;
}

export async function unblockUser(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.rpc("unblock_user", { p_user: userId });
  if (error) throw error;
}

/** Everyone the caller has blocked, newest first — the RPC's own ordering. */
export async function fetchMyBlockedUsers(
  supabase: SupabaseClient,
): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc("my_blocked_users");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    fullName: (row.full_name as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    blockedAt: new Date(row.blocked_at as string),
  }));
}

/**
 * Has this person accepted the terms yet?
 *
 * A column read rather than an RPC, because there isn't one — `profiles_select` lets you
 * read your own row. Returns false for anyone with no row at all, which includes guests:
 * they cannot post either way, and the guest wall is what tells them so.
 */
export async function hasAcceptedTerms(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("terms_accepted_at")
    .eq("id", userId)
    .maybeSingle();
  return Boolean((data as { terms_accepted_at?: string | null } | null)?.terms_accepted_at);
}

/**
 * Record acceptance.
 *
 * **The RPC coalesces**, so calling it twice never moves the original timestamp — the
 * first acceptance is the one on record. That is why the gate can call this without
 * checking again first, and why a double-click is harmless.
 *
 * `p_version` is the terms version being accepted. It defaults to `'1'` server-side when
 * blank; passing the constant explicitly keeps the client honest about *what* was agreed
 * rather than letting the default drift out from under it.
 */
export const TERMS_VERSION = "1";

export async function acceptTerms(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
  if (error) throw error;
}
