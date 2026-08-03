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
 * `20260801000004_guest_and_booking_guards.sql`.
 */

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
  /** A plan gate, e.g. style selection is Pro-only. */
  notEntitled: "P0001",
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
    case BOOKING_ERROR.notEntitled:
      // These carry a specific, useful reason ("this shop is not running a queue",
      // "style selection is a Pro feature") — pass it through rather than flatten it.
      return message ? asSentence(message) : fallback;
    default:
      return fallback;
  }
}
