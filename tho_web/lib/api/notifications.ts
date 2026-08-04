import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppNotification } from "../types/notification";
import { toNotification } from "./mappers";

/**
 * The in-app notification inbox, ported from the notifications section of
 * `tho/app/lib/data/api.dart:788`.
 *
 * Reads come straight from the table — `notifications_select` scopes them to
 * `recipient_profile_id = auth.uid()`, so there is no filter to add and no way to read
 * someone else's. Both writes are RPCs; there is no insert or update policy for users.
 *
 * **The rows exist independently of delivery.** `status` records whether push or SMS went
 * out, and today it is `failed` on every single row — no device is registered and no SMS
 * provider is configured. That has no bearing on this inbox: the row is the content, and
 * showing it is the one channel that works.
 */

/** The app's window: the 100 most recent. Enough to scroll, small enough for one request. */
const INBOX_LIMIT = 100;

export async function fetchNotifications(
  supabase: SupabaseClient,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(INBOX_LIMIT);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toNotification);
}

/**
 * How many are unread.
 *
 * A **head + exact count** query: it cannot be truncated by PostgREST's default row cap
 * the way counting a fetched page would be, and it transfers no rows to count them.
 */
export async function unreadNotificationCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Stamps one item read. The RPC re-checks the recipient, so an id alone proves nothing. */
export async function markNotificationRead(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", { p_id: id });
  if (error) throw error;
}

export async function markAllNotificationsRead(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
}
