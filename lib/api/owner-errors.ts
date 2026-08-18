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
  | "inviteStaff"
  | "unlinkStaff"
  | "saveStaffPay"
  | "saveStaffHours"
  | "saveSalonHours"
  | "saveSalon"
  | "createSalon"
  | "uploadPhoto"
  | "removePhoto"
  // 3c — the back office. Almost all of these are `P0001` raises whose message is better
  // than anything written here, because each one names a plan gate or a state machine.
  | "recordPayment"
  | "loadClientBook"
  | "saveClientNote"
  | "orderReady"
  | "orderCollected"
  // The delivery half of the lifecycle (`20260814000006`). Separate keys rather than one
  // "orderMove", because a fallback sentence has to name the thing that failed — "couldn't
  // mark it collected" on a delivery order would be a second wrong statement on top of a
  // failed write.
  | "orderOutForDelivery"
  | "orderDelivered"
  | "orderDecline"
  | "saveProduct"
  | "toggleProductStock"
  | "archiveProduct"
  | "restoreProduct"
  | "saveOffer"
  | "toggleOffer"
  | "deleteOffer"
  | "saveLoyaltyProgram"
  | "saveReward"
  | "toggleReward"
  | "archiveReward"
  | "confirmRedemption"
  | "declineRedemption"
  | "adjustPoints"
  | "loadPayroll"
  | "loadTaxEstimate"
  | "requestPlanChange";

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
  inviteStaff: "Couldn't send that invite. Check the email and try again.",
  unlinkStaff: "Couldn't unlink.",
  saveStaffPay: "Couldn't save pay.",
  recordPayment: "Couldn't record that payment. Please try again.",
  saveStaffHours: "Couldn't save these hours.",
  saveSalonHours: "Couldn't save your opening hours.",
  saveSalon: "Couldn't save. Please try again.",
  createSalon: "Couldn't create the salon. Please try again.",
  uploadPhoto: "Couldn't upload that photo.",
  removePhoto: "Couldn't remove that photo.",
  loadClientBook: "Couldn't load your client book.",
  saveClientNote: "Couldn't save that note.",
  orderReady: "Couldn't mark it ready.",
  orderCollected: "Couldn't mark it collected.",
  orderOutForDelivery: "Couldn't send it out for delivery.",
  orderDelivered: "Couldn't mark it delivered.",
  orderDecline: "Couldn't decline that order.",
  saveProduct: "Couldn't save. Please try again.",
  toggleProductStock: "Couldn't update availability.",
  archiveProduct: "Couldn't remove that product.",
  restoreProduct: "Couldn't bring it back.",
  saveOffer: "Couldn't save. Please try again.",
  toggleOffer: "Couldn't update that offer.",
  deleteOffer: "Couldn't delete that offer.",
  saveLoyaltyProgram: "Couldn't save your loyalty settings.",
  saveReward: "Couldn't save. Please try again.",
  toggleReward: "Couldn't update.",
  archiveReward: "Couldn't remove.",
  confirmRedemption: "Couldn't confirm — check the code.",
  declineRedemption: "Couldn't decline.",
  adjustPoints: "Couldn't adjust those points.",
  loadPayroll: "Couldn't load payroll.",
  loadTaxEstimate: "Couldn't load the tax estimate.",
  requestPlanChange: "Couldn't send your request. Please try again.",
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
    // Every form validates the same rules first, so this is the safety net rather than the
    // message anyone should normally see. Naming the fields beats passing through
    // `new row for relation "services" violates check constraint "…"`, and which fields those
    // are depends entirely on the form — a `23514` from the reward sheet has nothing to do
    // with a duration.
    switch (action) {
      case "saveOffer":
        return "Check the discount (1–100%) and the dates.";
      case "saveReward":
        // `loyalty_rewards_shape`, `percent_off` 1–100, `amount_nu` > 0, `point_cost` > 0.
        return "Check the reward's value and its point cost.";
      case "saveLoyaltyProgram":
        return "Points per visit can't be negative, and Nu per point must be at least 1.";
      case "saveProduct":
        return "A price can't be negative.";
      default:
        return "One of those values isn't allowed. Check the duration, price and radius.";
    }
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
      case "recordPayment":
        /*
          `'payments require Pro'` · `'amount must be non-zero'` · `'invalid method'` ·
          `'invalid kind'` · `'booking not in this business'`. Every one names the thing to fix
          and the first is a plan gate, so the server's own words beat anything written here.
          The sheet validates the amount and constrains method and kind to the four values
          each, so in practice only the plan gate is reachable — from a salon downgraded
          between the render and the press.
        */
        return messageOf(error, fallback);
      case "createStaff":
      case "saveStaff":
        /*
          **The Basic stylist cap, which used to arrive as "please try again".**

          `20260807000004_basic_stylist_cap` added a trigger raising
          `'the Basic plan allows one active stylist — upgrade to add more'` on an insert that
          lands active *or* an update that flips inactive → active. Before that the cap was
          Dart-only and failed open, so this file had no `P0001` case for either action and
          both fell to their fallbacks: *"Couldn't add staff."* and *"Some changes couldn't be
          saved — please try again."*

          Telling somebody to retry an action that can never succeed is the worst available
          answer — worse than the raw message, which at least names the plan. So the server's
          own sentence goes through. The Flutter app still shows its fallback here.

          `staff-list.tsx` checks the cap before opening the create form and
          `staff-editor.tsx` before flipping Active, so reaching this is a stale page or a
          second till — not the normal path.
        */
        return messageOf(error, fallback);
      case "inviteStaff":
        // 'enter a valid email address' (22023) · 'this staff member already has a linked
        // account' / 'staff member not found' (P0001) · 'only the salon owner can invite
        // staff' (42501). Each names the thing to fix.
        //
        // **None of them reveals whether the address belongs to an account** — the RPC
        // answers identically either way, on purpose (it would otherwise be an
        // account-existence oracle). Passing the message straight through is safe here
        // *because* of that; do not add a friendlier branch on the client either.
        return messageOf(error, fallback);
      case "saveStaffHours":
        // 'overlapping working hours on the same day' / 'each interval needs day 0-6 and
        // end after start'. The editor blocks both, so this is the server having the last
        // word on something the grid let through.
        return messageOf(error, fallback);
      case "saveStaffPay":
        // 'payroll requires Pro' — the plan gate, and the one message that is the point.
        return messageOf(error, fallback);

      // ---- 3c ---------------------------------------------------------------
      case "loadClientBook":
      case "loadPayroll":
      case "loadTaxEstimate":
        // 'client book not available' / 'payroll requires Pro' / 'tax report requires Pro'.
        // Each page renders its locked state *instead of* calling, so reaching this means the
        // salon's plan changed between the render and the fetch — and then the server's own
        // words are the accurate ones.
        return messageOf(error, fallback);
      case "orderReady":
      case "orderCollected":
      case "orderOutForDelivery":
      case "orderDelivered":
        // 'illegal order status transition' — somebody at another till moved it first. Same
        // shape as the queue's race, and the same answer: say so and reload.
        //
        // The two delivery moves join this case rather than getting `messageOf`: the server's
        // sentence for a wrong-lifecycle move is the same 'illegal order status transition',
        // which tells an owner nothing they can act on. This one at least says what to do.
        return "That order was already dealt with. Refreshing.";
      case "orderDecline":
        // 'a reason is required to decline an order' — the sheet requires one, so this is the
        // server having the last word; and 'illegal order status transition' if it moved.
        return messageOf(error, fallback);
      case "adjustPoints":
        // 'adjustment would make balance negative' / 'reason is required' /
        // 'points must be non-zero'. All three name the exact thing to change.
        return messageOf(error, fallback);
      case "confirmRedemption":
        // 'redemption not found' (a mistyped code, the common case) / 'redemption is not
        // pending' (already honoured) / 'insufficient points'.
        return messageOf(error, fallback);
      case "declineRedemption":
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
