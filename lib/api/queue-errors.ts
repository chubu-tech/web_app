import { asSentence, errorCode } from "./booking-errors";

/**
 * Turning a queue RPC's rejection into a sentence.
 *
 * **The same code does not mean the same thing in both RPCs.** `P0004` is
 * "scan the shop's QR" from `join_queue` and "you're outside the check-in window"
 * from `check_in_booking` — two unrelated facts sharing one code, because the window
 * needed a code and `P0001` was already taken by the plan gate. So the map is keyed
 * by **(RPC, code)**, not by code alone: a single shared table would have to pick one
 * of the two meanings and be wrong half the time.
 *
 * Codes as raised in `../tho/supabase/migrations/20260801000002_queue_settings.sql`,
 * `20260731000002_queue_checkin_window_and_locking.sql` and
 * `20260801000004_guest_and_booking_guards.sql`.
 */

export const QUEUE_ERROR = {
  /** No session at all. */
  unauthenticated: "28000",
  /** The shop's plan doesn't include a queue, or the owner switched it off. */
  noQueue: "P0001",
  /** Already holding a place in *this* shop's line. Not an error — a redirect. */
  alreadyInLine: "P0003",
  /** `join_queue`: qr_only and this wasn't a scan. `check_in_booking`: outside the window. */
  refusedP0004: "P0004",
  /** A guest tried to commit — `private.is_real_user()` refused. */
  guestRefused: "P0010",
} as const;

/**
 * True when the customer already holds a place here.
 *
 * The caller's job is to **send them to their position**, not to show a message:
 * re-scanning the shop's QR while waiting is a "where am I?" gesture, not a second
 * join attempt. The app's older screen showed an error for this and it was wrong.
 */
export function isAlreadyInLine(error: unknown): boolean {
  return errorCode(error) === QUEUE_ERROR.alreadyInLine;
}

/** True when a `qr_only` salon refused a join that didn't come through its QR. */
export function needsScan(error: unknown): boolean {
  return errorCode(error) === QUEUE_ERROR.refusedP0004;
}

/** What to show for a failed `join_queue`. */
export function joinQueueErrorMessage(error: unknown): string {
  const code = errorCode(error);
  switch (code) {
    case QUEUE_ERROR.guestRefused:
      // Reaching this means the wall was bypassed — say what to do, rather than
      // dressing a guard up as a server fault.
      return "Create an account to join the queue.";
    case QUEUE_ERROR.refusedP0004:
      // Actionable, and fixable by the customer themselves at the counter — so it
      // must not read like the unavailable case below.
      return "Scan the shop's QR at the counter to join this queue.";
    case QUEUE_ERROR.noQueue:
      return "This shop isn't running a queue.";
    case QUEUE_ERROR.unauthenticated:
      return "Please sign in and try again.";
    default:
      return "Couldn't join the queue. Please try again.";
  }
}

/**
 * What to show for a failed `check_in_booking`.
 *
 * `P0004` is passed through rather than flattened: the server's own message names
 * *too early* ("check-in opens 2 hours before your appointment") versus *too old*,
 * and that distinction is the only actionable part of the refusal.
 */
export function checkInErrorMessage(error: unknown): string {
  const code = errorCode(error);
  const message =
    typeof error === "object" && error !== null
      ? ((error as { message?: string }).message ?? "")
      : "";
  switch (code) {
    case QUEUE_ERROR.noQueue:
      return "This shop isn't running a queue.";
    case QUEUE_ERROR.refusedP0004:
      return message ? asSentence(message) : "You can't check in for this booking yet.";
    case QUEUE_ERROR.unauthenticated:
      return "Please sign in and try again.";
    default:
      return "Couldn't check in.";
  }
}

/** `leave_queue` has one interesting failure — someone was called while they tapped. */
export function leaveQueueErrorMessage(): string {
  return "Couldn't leave the queue.";
}
