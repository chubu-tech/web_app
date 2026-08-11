/**
 * Turning a PostgREST rejection into a sentence.
 *
 * The RPCs raise with explicit `errcode`s and lowercase, unpunctuated messages
 * written for a log, not a customer. Matching on the **code** rather than the text
 * means the mapping survives a reworded `raise`; `booking_detail_screen.dart:205`
 * does the same capitalisation trick for the ones we do pass through.
 *
 * Codes as raised by `create_booking` and friends in
 * `../tho/supabase/migrations/20260802000001_one_booking_per_day.sql` and
 * `20260801000004_guest_and_booking_guards.sql`, then extended by the 2026-08-07 batch —
 * `20260807000031` (P0014), `…032` (P0015), `…035` (P0016) and `20260807000006` (P0013).
 * The table mirrors `bookingFailureMessage` in `../tho/app/lib/customer/booking_guards.dart`
 * so the two clients say the same thing about the same refusal.
 */

// Relative, like every other import under `lib/`: there is no vitest config in this repo, so
// the `@/` alias resolves in the bundler and not in the test runner.
import { bookingBlockMessage } from "../booking-guards";

export const BOOKING_ERROR = {
  /** No session at all. */
  unauthenticated: "28000",
  /** A guest tried to commit — `private.is_real_user()` refused. */
  guestRefused: "P0010",
  /** Overlaps a booking the customer already has, at any salon. */
  overlaps: "P0011",
  /** Already has a live booking that calendar day, at any salon. */
  sameDay: "P0012",
  /** The exclusion constraint fired — someone else took the slot first. */
  slotTaken: "23P01",
  /** Acting on a booking that isn't theirs. */
  notYours: "42501",
  /**
   * The booking id doesn't resolve — deleted, or never existed. Raised by
   * `set_booking_reminders`.
   *
   * Note `P0002` means something else entirely for `place_order` (*"a product is no longer
   * available"*), which is exactly why `queue-errors.ts` maps by **(RPC, code)** rather than
   * by code alone. This table is booking-scoped so it is unambiguous here; the collision is
   * worth knowing before anyone merges the two.
   */
  missing: "P0002",
  /** A plan gate, e.g. style selection is Pro-only. */
  notEntitled: "P0001",
  /**
   * The account is suspended. Raised by the insert trigger on `bookings`, `queue_entries`
   * and `orders` (`20260807000006_enforce_user_block`) rather than by any RPC body, so it
   * can arrive from a call that has no other reason to fail.
   */
  suspended: "P0013",
  /**
   * The idempotency key already made a booking **with different details**
   * (`20260807000031_idempotency_argument_match`). Before that, replaying a key with a
   * changed time silently returned the original booking as though the new request had
   * succeeded — so this code exists precisely to stop a retry looking like a move.
   */
  idempotencyMismatch: "P0014",
  /**
   * Past the salon's own `cancellation_window_hours`
   * (`20260807000032_cancellation_window`), from **both** `cancel_booking` and
   * `reschedule_booking` — and for reschedule the window is measured against the *current*
   * start, the commitment being broken, not the new one.
   */
  cancellationClosed: "P0015",
  /**
   * The start has already passed (`20260807000035_reject_past_start`), from
   * `create_booking` and `reschedule_booking`. A salon member is exempt: back-filling this
   * morning's walk-in at lunchtime is ordinary shop work.
   */
  pastStart: "P0016",
} as const;

type PgError = { code?: string; message?: string };

function asPgError(error: unknown): PgError {
  if (typeof error === "object" && error !== null) return error as PgError;
  return {};
}

export function errorCode(error: unknown): string | undefined {
  return asPgError(error).code;
}

/** True when the server refused because the caller is a guest. */
export function isGuestRefusal(error: unknown): boolean {
  return errorCode(error) === BOOKING_ERROR.guestRefused;
}

/** True when the slot was taken between loading it and confirming. */
export function isSlotTaken(error: unknown): boolean {
  return errorCode(error) === BOOKING_ERROR.slotTaken;
}

/** Server messages are lowercase and unpunctuated; a toast reads as a sentence. */
export function asSentence(message: string): string {
  if (!message) return message;
  const capitalised = message[0]!.toUpperCase() + message.slice(1);
  return capitalised.endsWith(".") ? capitalised : `${capitalised}.`;
}

/**
 * What to show for a failed booking action.
 *
 * `guestRefused` is deliberately absent from the happy path here: a guest should have
 * met the wall *before* the RPC, so reaching this branch means the wall was bypassed
 * — the message says what to do rather than pretending it was a server fault.
 */
export function bookingErrorMessage(error: unknown, fallback: string): string {
  const { code, message } = asPgError(error);
  switch (code) {
    case BOOKING_ERROR.guestRefused:
      return "Create an account to book this appointment.";
    case BOOKING_ERROR.overlaps:
      return "You already have a booking at that time. Cancel it first, or pick another slot.";
    case BOOKING_ERROR.sameDay:
      return "You already have a booking that day. Cancel it first, or pick another day.";
    case BOOKING_ERROR.slotTaken:
      return "Couldn't book that slot — it may have just been taken.";
    case BOOKING_ERROR.unauthenticated:
      return "Please sign in and try again.";
    case BOOKING_ERROR.notYours:
      return "That booking isn't yours to change.";
    case BOOKING_ERROR.missing:
      return "That booking no longer exists.";
    case BOOKING_ERROR.suspended:
      return "This account is suspended. Contact Tho support if you think that is wrong.";
    case BOOKING_ERROR.idempotencyMismatch:
      return "That booking already went through with different details. Open your bookings to see it.";
    case BOOKING_ERROR.cancellationClosed: {
      // The RPC names the salon's own number of hours ("free cancellation closed 12 hours
      // before the appointment"), which is more use than any generic line — and it is the
      // salon's rule, so it should be the salon's number.
      const window = message ? asSentence(message) : "";
      return window
        ? `${window} Call the salon if you need to change it.`
        : "Free cancellation has closed for this booking. Call the salon to change it.";
    }
    case BOOKING_ERROR.pastStart:
      return bookingBlockMessage("pastStart");
    case BOOKING_ERROR.notEntitled:
      // These carry a specific, useful reason ("this shop is not running a queue",
      // "style selection is a Pro feature") — pass it through rather than flatten it.
      return message ? asSentence(message) : fallback;
    default:
      return fallback;
  }
}
