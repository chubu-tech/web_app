import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueueEntry } from "../types/queue";
import { toQueueEntry } from "./mappers";

/**
 * Walk-in queue reads and writes, ported from the queue section of
 * `tho/app/lib/data/api.dart:1449-1557`.
 *
 * **Every write is an RPC** — `join_queue`, `leave_queue` and `check_in_booking`
 * authorise the caller, enforce the plan gate and the owner's switch, and stamp the
 * server clock on `joined_at`. `queue_entries` is `revoke insert, update, delete`
 * for `authenticated`, so there is no direct write to reach for.
 */

/** The embeds a direct `queue_entries` read wants: the service's length and the salon's name. */
const QUEUE_SELECT = "*, services(duration_minutes), businesses(name)";

/** An RPC returning `public.queue_entries` can arrive as a row or a single-element list. */
function oneRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  if (row == null || typeof row !== "object") throw new Error("queue RPC returned no row");
  return row as Record<string, unknown>;
}

/**
 * The shop's active line (waiting + serving), PII-free, via `queue_active_line`.
 *
 * **Not a direct table read**, and that is the whole point: a customer's RLS-scoped
 * read of `queue_entries` returns only their *own* row, which made position and ETA
 * compute as "#1 · 0 min" against a one-element list. The RPC returns every row with
 * the identifying columns stripped, so the pure helpers can run over the real line.
 *
 * Its projection omits `business_id` — every row belongs to `businessId` by
 * construction — so that is threaded in as the mapper's fallback.
 *
 * Callable by any authenticated user for a growth/pro shop (the pre-join preview
 * relaxation in `20260731000003_queue_preview.sql`), and **not callable by `anon`**:
 * a signed-out visitor gets a permission error, which surfaces as "Wait unknown"
 * rather than a fabricated zero.
 */
export async function fetchActiveLine(
  supabase: SupabaseClient,
  businessId: string,
): Promise<QueueEntry[]> {
  const { data, error } = await supabase.rpc("queue_active_line", { p_business: businessId });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => toQueueEntry(row, businessId));
}

/**
 * Take a place in the line.
 *
 * **`viaQr` is always sent.** `join_queue` has two overloads and the 4-arg one
 * delegates with `p_via_qr => false`, so omitting it silently claims "not a scan".
 * That is the safe default, but the intent belongs here rather than in a delegation
 * two migrations away — and a `qr_only` salon refuses anything else with P0004, so
 * claiming a scan we didn't have would trade a signposted instruction for a failure.
 *
 * `name` is only meaningful for a business member adding a walk-in at the counter;
 * a customer joining themselves leaves it null and the RPC takes their profile.
 */
export async function joinQueue(
  supabase: SupabaseClient,
  {
    businessId,
    staffId,
    serviceId,
    viaQr,
    name = null,
  }: {
    businessId: string;
    staffId: string | null;
    serviceId: string | null;
    viaQr: boolean;
    name?: string | null;
  },
): Promise<QueueEntry> {
  const { data, error } = await supabase.rpc("join_queue", {
    p_business: businessId,
    p_staff: staffId,
    p_service: serviceId,
    p_name: name,
    p_via_qr: viaQr,
  });
  if (error) throw error;
  return toQueueEntry(oneRow(data));
}

/** Give the place up. Only legal while `waiting` — see `canCustomerLeave`. */
export async function leaveQueue(
  supabase: SupabaseClient,
  entryId: string,
): Promise<QueueEntry> {
  const { data, error } = await supabase.rpc("leave_queue", { p_entry: entryId });
  if (error) throw error;
  return toQueueEntry(oneRow(data));
}

/**
 * Hand a booking to the shop's line — "I'm here".
 *
 * The entry carries `priority_at = start_ts`, which is what puts an appointment
 * ahead of walk-ins who joined earlier. **Idempotent**: an already-checked-in
 * booking returns its existing entry, deliberately *before* the window check, so
 * someone who checked in on time can reopen their live view after a long wait.
 */
export async function checkInBooking(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<QueueEntry> {
  const { data, error } = await supabase.rpc("check_in_booking", { p_booking: bookingId });
  if (error) throw error;
  return toQueueEntry(oneRow(data));
}

/**
 * Every place the caller currently holds, oldest first.
 *
 * Filtered on `customer_profile_id` explicitly rather than leaning on RLS alone:
 * `queue_select_member` OR-matches customer *or* business member, so a user who is
 * also a member of a salon would otherwise be handed their own shop's other rows.
 *
 * A list rather than the app's single row, because a customer really can hold a
 * place at two shops at once — `join_queue`'s P0003 is scoped to one business.
 */
export async function fetchMyActiveEntries(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueueEntry[]> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select(QUEUE_SELECT)
    .eq("customer_profile_id", userId)
    .in("status", ["waiting", "serving"])
    .order("joined_at");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => toQueueEntry(row));
}

/**
 * The caller's active place at **this** salon, if any.
 *
 * A deliberate correction to the app: `myActiveQueueEntry` returns the oldest entry
 * across *all* shops, so its already-in-this-queue recovery can send someone to a
 * different salon's position screen than the QR they just scanned.
 */
export async function fetchActiveEntryForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
): Promise<QueueEntry | null> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select(QUEUE_SELECT)
    .eq("customer_profile_id", userId)
    .eq("business_id", businessId)
    .in("status", ["waiting", "serving"])
    .order("joined_at")
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows[0] ? toQueueEntry(rows[0]) : null;
}

/**
 * One entry by id, for the live view's first render.
 *
 * RLS scopes this to the caller's own entry, so a stranger's id is simply not found
 * — no ownership check needed here. Terminal statuses are included on purpose: the
 * view has to be able to say "you're all done" rather than 404 on a finished place.
 */
export async function fetchQueueEntryById(
  supabase: SupabaseClient,
  entryId: string,
): Promise<QueueEntry | null> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select(QUEUE_SELECT)
    .eq("id", entryId)
    .maybeSingle();
  if (error) throw error;
  return data ? toQueueEntry(data as Record<string, unknown>) : null;
}
