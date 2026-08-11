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

/**
 * One page of the inbox, matching `Api.notificationsPageSize`.
 *
 * **This used to be a flat `limit(100)` with no way past it**, which is the bug upstream fixed
 * as audit A4-12: at a hard cap and no paging, the 101st notification made the *first* one
 * unreachable for good. A cap is only honest when there is a way to the other side of it.
 */
export const NOTIFICATIONS_PAGE_SIZE = 50;

/**
 * The caller's notifications, newest first.
 *
 * `notifications_select` scopes rows to `recipient_profile_id = auth.uid()` **and** to what is
 * due or terminal — a reminder scheduled for Saturday is a real queue row on Thursday and is
 * deliberately invisible until it is due (`20260807000023`). So this needs no `now()` filter of
 * its own, and must not grow one: the badge is a `count` on the same table, and a client that
 * sent its own clock could make the list and the badge disagree.
 *
 * **Half-open range, like the Dart's `.range(offset, offset + size - 1)`.** Offset paging is
 * what upstream does and it carries upstream's one flaw: a notification arriving between two
 * pages shifts the window, so a row can repeat. The caller de-duplicates by id on append rather
 * than pretending otherwise — a keyset cursor on `created_at` would be exact, and would be a
 * divergence from the app for a list nobody scrolls twice.
 */
export async function fetchNotifications(
  supabase: SupabaseClient,
  { offset = 0, limit = NOTIFICATIONS_PAGE_SIZE }: { offset?: number; limit?: number } = {},
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
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
