import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking, BookingStatus } from "../types/booking";
import type { QueueEntry, QueueStatus } from "../types/queue";
import type { Business } from "../types/salon";
import { BOOKING_SELECT } from "./booking";
import { toBooking, toBusiness, toQueueEntry } from "./mappers";

/**
 * The owner console's reads and writes — the salon's side of data the customer side
 * already reads, ported from the owner half of `tho/app/lib/data/api.dart`.
 *
 * **Two rules this file exists to keep.**
 *
 * 1. **Every read filters explicitly; RLS is not a scope.** The policies here OR-match
 *    (`bookings_select` is `customer_profile_id = auth.uid() OR is_business_member(...)`,
 *    `queue_select_member` sits beside `queue_select_customer`, `businesses_select`
 *    admits any *member* including active staff). A read that leans on RLS alone returns
 *    a union of two different questions. `fetchMyBookings` shipped that way and showed a
 *    salon's whole book under "My bookings"; the correction is now in four places.
 * 2. **Every write is an RPC**, and not by preference — `authenticated` holds no
 *    table-level INSERT/UPDATE/DELETE on `bookings` or `queue_entries` at all, so there
 *    is nothing to write directly even if a policy allowed it. Each RPC authorises the
 *    caller itself with `private.is_business_member`.
 */

/* --------------------------------------------------------------------------
   The owner's salons.
   -------------------------------------------------------------------------- */

/**
 * Every salon this user **owns**, oldest first — the switcher's list, and the order
 * `resolveActiveBusinessId` treats as "the first".
 *
 * `owner_id` is matched explicitly rather than left to `businesses_select`, whose
 * `private.is_business_member(id)` branch also admits an active `staff_members.profile_id`
 * — so an owner who is also on someone else's roster would otherwise find that salon in
 * their own switcher. It is `owner_id` that `businesses_update`, `services`, `staff` and
 * every other owner write key off, so it is the only definition of "mine" that matches
 * what the console can actually do.
 *
 * No rating join: the owner console never shows stars, and `businesses_select`'s member
 * branch returns their `pending`, `rejected` and inactive salons too, which is deliberate
 * — an owner must be able to see a salon that is waiting for review.
 */
export async function fetchMyBusinesses(
  supabase: SupabaseClient,
  userId: string,
): Promise<Business[]> {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toBusiness);
}

/* --------------------------------------------------------------------------
   The day.
   -------------------------------------------------------------------------- */

/**
 * One salon's bookings in a half-open range, ascending — `Api.bookingsForRange`.
 *
 * The range is UTC and comes from `thimphuDayBoundsUtc`, because a "day" in this product
 * is a Thimphu day and the column is a `timestamptz`. Half-open (`gte` … `lt`) for the
 * same reason the bounds helper is: a booking at exactly midnight belongs to one day, not
 * both.
 *
 * **Cancelled and no-show bookings come back too**, unlike the calendar's *week* grouping,
 * which drops them. That is not an inconsistency: the day list is a record of what
 * happened and the owner needs to see a cancellation, whereas a week header counting them
 * would claim work that is not there. `isActiveBooking` in `lib/calendar-logic.ts` is
 * where that line is drawn.
 */
export async function fetchBusinessBookings(
  supabase: SupabaseClient,
  businessId: string,
  { from, to }: { from: Date; to: Date },
): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("business_id", businessId)
    .gte("start_ts", from.toISOString())
    .lt("start_ts", to.toISOString())
    .order("start_ts", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toBooking);
}

/** One booking, scoped to a salon so the owner page cannot open someone else's. */
export async function fetchBusinessBookingById(
  supabase: SupabaseClient,
  businessId: string,
  bookingId: string,
): Promise<Booking | null> {
  const { data } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("business_id", businessId)
    .eq("id", bookingId)
    .maybeSingle();
  return data ? toBooking(data as unknown as Record<string, unknown>) : null;
}

/* --------------------------------------------------------------------------
   The booking lifecycle.
   -------------------------------------------------------------------------- */

/**
 * Confirm, complete or mark a no-show — `set_booking_status`.
 *
 * The RPC accepts **only** those three. Cancelling has its own call (`cancelBooking` in
 * `./booking.ts`, shared with the customer) because it carries a reason and different
 * side effects, and any `from` status outside `pending`/`confirmed` is refused with
 * *"cannot transition from % (booking is finalized)"*.
 *
 * Not a display change: the `booking_status_events` row this writes fires
 * `handle_booking_status_event`, which on `completed` awards loyalty points and queues a
 * review request, and on `no_show` cancels the booking's pending reminders.
 */
export async function setBookingStatus(
  supabase: SupabaseClient,
  bookingId: string,
  status: Extract<BookingStatus, "confirmed" | "completed" | "no_show">,
  reason?: string | null,
): Promise<Booking> {
  const { data, error } = await supabase.rpc("set_booking_status", {
    p_booking_id: bookingId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return toBooking(data as Record<string, unknown>);
}

/**
 * Put a booking back to an earlier status — the Undo behind Cancel.
 *
 * `reconcile_booking` is the **only** call with no transition validation: it assigns
 * whatever status it is given, from any status, including a terminal one. That is exactly
 * why it can undo a cancellation and why it is not used for anything else here — a
 * reason is mandatory, and every call is recorded as `reconcile: <reason>` in
 * `booking_status_events`.
 */
export async function reconcileBooking(
  supabase: SupabaseClient,
  bookingId: string,
  { reason, status }: { reason: string; status: BookingStatus },
): Promise<Booking> {
  const { data, error } = await supabase.rpc("reconcile_booking", {
    p_booking_id: bookingId,
    p_reason: reason,
    p_new_status: status,
  });
  if (error) throw error;
  return toBooking(data as Record<string, unknown>);
}

/* --------------------------------------------------------------------------
   The live line.
   -------------------------------------------------------------------------- */

/**
 * The embeds the owner board needs and the customer's RPC cannot give it.
 *
 * **`full_name` is in this list and is not in the app's**, which is a bug in the app rather
 * than a preference here. `Api.queueForBusiness` selects only `(avatar_url, phone)`, and both
 * clients label a row `customerName ?? 'Walk-in'` — but `queue_entries.customer_name` is
 * populated *only* for a walk-in the shop typed in by hand. So on the Flutter board every
 * customer who joined the line themselves reads **"Walk-in"**, with their avatar and phone
 * beside it. Caught here by putting a real customer in the line and looking at the board.
 */
const OWNER_QUEUE_SELECT =
  "*, services(duration_minutes), " +
  "profiles!queue_entries_customer_profile_id_fkey(full_name, avatar_url, phone)";

/**
 * The salon's active line — everyone `waiting` or `serving`, oldest join first.
 *
 * **A direct table read, deliberately not `queue_active_line`.** That RPC is what the
 * *customer's* live view polls and its projection is PII-free by design: no name, no
 * phone, no avatar, no `called_at`. A board whose entire job is to say who is in the
 * chair cannot be built on it.
 *
 * Two permissions make this work, and both are narrower than they look:
 * `queue_select_member` allows the rows, and `profiles_select`'s third branch allows the
 * join — a business member may read a customer who is **in their queue**, not merely one
 * who has booked. The foreign key is named explicitly rather than left to PostgREST's
 * relationship guess; `queue_entries` has exactly one FK to `profiles`, but naming it
 * means a second one arriving later breaks the build instead of the board.
 *
 * The `joined_at` order is only a stable base. The line's real order is priority-then-FIFO
 * and belongs to `orderedShopWide` in `lib/queue-logic.ts`, which mirrors the server's own
 * `private.queue_claim_front`.
 */
export async function fetchBusinessQueue(
  supabase: SupabaseClient,
  businessId: string,
): Promise<QueueEntry[]> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select(OWNER_QUEUE_SELECT)
    .eq("business_id", businessId)
    .in("status", ["waiting", "serving"])
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
    toQueueEntry(row, businessId),
  );
}

/**
 * Take the front of the line into a chair — `call_next`.
 *
 * The server claims the row with `for update skip locked` and the *same* ordering
 * `orderedFor` reproduces, which is what lets the board move the row optimistically
 * before the call returns. It sets `serving`, fills `staff_member_id` when the guest had
 * no preference, and stamps `called_at` and `served_at` together — there is no
 * "called, not yet arrived" state to render.
 *
 * Raises `P0001 'queue is empty'` when there is nothing to claim, including when it loses
 * the race to another till. `lib/api/owner-errors.ts` turns that into a sentence.
 */
export async function callNext(
  supabase: SupabaseClient,
  businessId: string,
  staffId: string,
): Promise<QueueEntry> {
  const { data, error } = await supabase.rpc("call_next", {
    p_business: businessId,
    p_staff: staffId,
  });
  if (error) throw error;
  return toQueueEntry(oneRow(data), businessId);
}

/**
 * Finish or write off a place in line — `set_queue_status`.
 *
 * The server allows exactly `serving → done` and `waiting|serving → no_show`, and
 * `canOwnerQueueTransition` in `lib/queue-logic.ts` mirrors that set so the board never
 * offers a move the database will refuse. `done` and `no_show` are terminal, which is why
 * there is no Undo here — unlike a cancelled booking, which `reconcileBooking` genuinely
 * reverses.
 */
export async function setQueueStatus(
  supabase: SupabaseClient,
  entryId: string,
  status: QueueStatus,
): Promise<QueueEntry> {
  const { data, error } = await supabase.rpc("set_queue_status", {
    p_entry: entryId,
    p_status: status,
  });
  if (error) throw error;
  return toQueueEntry(oneRow(data));
}

/**
 * These RPCs return `SETOF queue_entries`, which PostgREST hands back as a single object
 * or a one-element array depending on the call. Same normalisation `./queue.ts` does.
 */
function oneRow(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return (data[0] ?? {}) as Record<string, unknown>;
  return (data ?? {}) as Record<string, unknown>;
}
