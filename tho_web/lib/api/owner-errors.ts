import { asSentence, errorCode } from "./booking-errors";

/**
 * Turning an owner-side RPC rejection into a sentence.
 *
 * A third error module rather than a fourth case in one table, for the reason
 * `queue-errors.ts` already records: **the same SQLSTATE means different things in
 * different RPCs.** `P0001` is `'queue is empty'` from `call_next`, `'illegal queue
 * transition'` from `set_queue_status` and `'cannot transition from % (booking is
 * finalized)'` from `set_booking_status`, and each wants different words. So these are
 * keyed by *(action, code)*, never by code alone and never by message text — the
 * messages are lowercase, unpunctuated, and written for a log.
 *
 * The one thing every owner action shares: `42501` is `'not authorized'`, raised when
 * `private.is_business_member` says no. It should be unreachable — the console only
 * renders actions for the active salon, and the layout has already established
 * ownership — so reaching it means the salon switched underneath the page, which is what
 * the copy says.
 */

export const OWNER_ERROR = {
  /** No session. The cookie expired mid-shift. */
  unauthenticated: "28000",
  /** `private.is_business_member` refused: not this salon's staff any more. */
  notAuthorized: "42501",
  /** The catch-all `raise exception` — meaning depends entirely on the RPC. */
  raised: "P0001",
  /** `bookings_no_overlap` fired: that stylist is already busy then. */
  overlaps: "23P01",
  /**
   * A CHECK constraint refused the value. Only the setup forms can reach it, and only for
   * something the form should have caught first — `services_duration_minutes_check`,
   * `services_price_check`, `services_category_check`, `businesses_service_radius_km_check`,
   * `business_hours_check`. Treated as a bug in the form, worded as a nudge.
   */
  checkFailed: "23514",
  /** A unique constraint: two segments of the same day opening at the same time. */
  duplicate: "23505",
} as const;

/** Which owner action failed. The same code needs different words for each. */
export type OwnerAction =
  | "callNext"
  | "queueDone"
  | "queueNoShow"
  | "confirmBooking"
  | "completeBooking"
  | "noShowBooking"
  | "cancelBooking"
  | "undoCancel"
  | "addWalkIn"
  // 3b — setup. These mostly fail on a CHECK constraint rather than a raise, which is why
  // `23514` and `23505` matter here and nowhere above.
  | "saveService"
  | "toggleService"
  | "enableCatalogService"
  | "createStaff"
  | "saveStaff"
  | "linkStaff"
  | "unlinkStaff"
  | "saveStaffPay"
  | "saveStaffHours"
  | "saveSalonHours"
  | "saveSalon"
  | "createSalon"
  | "uploadPhoto"
  | "removePhoto";

const FALLBACK: Record<OwnerAction, string> = {
  callNext: "Couldn't call the next guest.",
  queueDone: "Couldn't complete.",
  queueNoShow: "Couldn't mark no-show.",
  confirmBooking: "Couldn't confirm.",
  completeBooking: "Couldn't update.",
  noShowBooking: "Couldn't update.",
  cancelBooking: "Couldn't cancel.",
  undoCancel: "Couldn't undo.",
  addWalkIn: "Couldn't add them to the queue. Please try again.",
  saveService: "Couldn't save. Please try again.",
  toggleService: "Couldn't update.",
  enableCatalogService: "Couldn't update.",
  createStaff: "Couldn't add staff.",
  saveStaff: "Some changes couldn't be saved — please try again.",
  linkStaff: "Couldn't link that account. Check the email and try again.",
  unlinkStaff: "Couldn't unlink.",
  saveStaffPay: "Couldn't save pay.",
  saveStaffHours: "Couldn't save these hours.",
  saveSalonHours: "Couldn't save your opening hours.",
  saveSalon: "Couldn't save. Please try again.",
  createSalon: "Couldn't create the salon. Please try again.",
  uploadPhoto: "Couldn't upload that photo.",
  removePhoto: "Couldn't remove that photo.",
};

/**
 * What to show the owner when an action fails.
 *
 * The fallbacks are the app's own strings verbatim, so a salon that uses both clients
 * reads the same sentence for the same failure.
 */
export function ownerErrorMessage(action: OwnerAction, error: unknown): string {
  const code = errorCode(error);
  const fallback = FALLBACK[action];

  if (code === OWNER_ERROR.unauthenticated) {
    return "Your session expired. Sign in and try again.";
  }
  if (code === OWNER_ERROR.notAuthorized) {
    return "You no longer have access to this salon.";
  }
  if (code === OWNER_ERROR.overlaps) {
    // Only reachable from the walk-in form and a reschedule: `bookings_no_overlap`
    // covers `pending`/`confirmed` rows for one stylist.
    return "That stylist already has a booking then. Pick another time.";
  }

  if (code === OWNER_ERROR.checkFailed) {
    // The form validates the same rules first, so this is the safety net rather than the
    // message anyone should normally see. Naming the field beats passing through
    // `new row for relation "services" violates check constraint "…"`.
    return "One of those values isn't allowed. Check the duration, price and radius.";
  }
  if (code === OWNER_ERROR.duplicate) {
    return "Those hours are already listed for that day.";
  }

  if (code === OWNER_ERROR.raised) {
    switch (action) {
      case "callNext":
        // 'queue is empty' — the line emptied between the render and the press, which
        // on a 4-second poll with two tills open is an ordinary race, not a fault.
        return "The line is empty — nobody left to call.";
      case "queueDone":
      case "queueNoShow":
        // 'illegal queue transition' — someone else settled this entry first.
        return "That guest was already dealt with. Refreshing the board.";
      case "confirmBooking":
      case "completeBooking":
      case "noShowBooking":
        // 'cannot transition from % (booking is finalized)' — carries the current
        // status, which is the useful part, so it is passed through.
        return messageOf(error, fallback);
      case "cancelBooking":
        // 'only active bookings can be cancelled (current: %)'.
        return messageOf(error, fallback);
      case "addWalkIn":
        // 'this shop is not running a queue' / 'service not found for this business'
        // — each names the thing to fix.
        return messageOf(error, fallback);
      case "linkStaff":
        // 'Could not link this account. Ask the person to create an account first, then
        // link.' — already a sentence written for a human, and the only useful reply.
        return messageOf(error, fallback);
      case "saveStaffHours":
        // 'overlapping working hours on the same day' / 'each interval needs day 0-6 and
        // end after start'. The editor blocks both, so this is the server having the last
        // word on something the grid let through.
        return messageOf(error, fallback);
      case "saveStaffPay":
        // 'payroll requires Pro' — the plan gate, and the one message that is the point.
        return messageOf(error, fallback);
      default:
        return messageOf(error, fallback);
    }
  }

  return fallback;
}

function messageOf(error: unknown, fallback: string): string {
  const message =
    typeof error === "object" && error !== null
      ? (error as { message?: string }).message
      : undefined;
  return message ? asSentence(message) : fallback;
}
