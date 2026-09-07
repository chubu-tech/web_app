/**
 * When an owner may finalize a booking, and how to say so when they may not.
 *
 * A port of `../tho/app/lib/business/booking_status_rules.dart`, and the client half of a
 * server rule: migration `20260902000001_status_time_gate.sql` made `set_booking_status`
 * refuse `completed` and `no_show` while the appointment has not started, with errcode
 * **P0017**. Before it, an 8pm cut could be completed at 10am.
 *
 * That is not a cosmetic wrong status. `completed` is the event the loyalty ledger awards
 * points on, the event that burns a prepaid pack credit, and the event analytics, payroll
 * and the Bhutan tax estimate count as earned revenue — and the booking was then finalized,
 * so nothing unwound it.
 *
 * **The boundary is `start_ts`, not `end_ts`.** A 30-minute cut finished in 20 is ordinary
 * shop work, so the moment the chair is occupied is the moment the button is honest.
 *
 * **And the client is deliberately stricter than the server.** The server allows from
 * `start_ts - 5 minutes`; this hides the buttons until `start_ts` itself. A till tablet with
 * a fast clock must never offer a button the server will refuse, so the slack belongs on the
 * server's side of the line and nowhere else.
 */

/** Just the fields the rules read, so a caller need not hold a whole `Booking`. */
type Finalizable = { startTs: Date };

/** True once `completed` / `no_show` are honest — i.e. the appointment is under way. */
export function canFinalizeBooking(booking: Finalizable, now: Date = new Date()): boolean {
  return now.getTime() >= booking.startTs.getTime();
}

/**
 * The caption that stands where the Complete button will be, or `null` once it is there.
 *
 * **Relative, not absolute**, and for two reasons. It reads as a countdown rather than a
 * second copy of information the card beside it already prints — every surface that shows
 * this also shows the appointment's date and time. And upstream's absolute form overflowed a
 * 320dp phone by 130px, which is the class of defect this repo keeps re-learning.
 *
 * Rounds **up**, so "Complete in 1m" never sits on a button that is still a minute away from
 * working.
 */
export function finalizeUnlocksHint(booking: Finalizable, now: Date = new Date()): string | null {
  const msLeft = booking.startTs.getTime() - now.getTime();
  if (msLeft <= 0) return null;

  const minutes = Math.ceil(msLeft / 60_000);
  if (minutes < 60) return `Complete in ${minutes}m`;

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `Complete in ${hours}h`;

  return `Complete in ${Math.ceil(hours / 24)}d`;
}

/**
 * The same, phrased for the moment it flips.
 *
 * A screen left open across the start should stop saying "in 1m" and say the buttons are
 * there — the alternative is a caption that has quietly become a lie while somebody watched
 * it.
 */
export function finalizeHintOrUnlocked(booking: Finalizable, now: Date = new Date()): string {
  return finalizeUnlocksHint(booking, now) ?? "Complete unlocks now";
}
