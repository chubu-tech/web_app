import type { Booking } from "./types/booking";
import { THIMPHU_OFFSET_MIN, thimphuDayOf } from "./time";

/**
 * A client-side reading of the rules `create_booking` enforces server-side,
 * ported from `tho/app/lib/customer/booking_guards.dart`.
 *
 * **The server remains the authority.** Everything here exists only to turn a
 * rejection the customer would have hit anyway into a sentence they see first.
 * Never treat a pass here as permission — always let the RPC decide.
 */

/** Why a slot can't be booked. */
export type BookingBlock =
  /** Overlaps a booking the customer already has, anywhere. Mirrors P0011. */
  | "overlapsExisting"
  /**
   * Already booked somewhere on this day. Mirrors P0012 — one active booking per
   * calendar day, at *any* salon.
   */
  | "alreadyBookedThatDay"
  /**
   * The slot has already gone by. Mirrors P0016, added by
   * `20260807000035_reject_past_start`.
   *
   * Until that migration both `create_booking` and `reschedule_booking` accepted a
   * start in the past — only `compute_availability` ever filtered — so a confirmed
   * booking could be written onto last Tuesday, into rows that feed
   * `analytics_dashboard`, `payroll_report` and the tax estimate.
   *
   * The grid is filtered server-side, so this is not the common path: it is the slot
   * that expired while the customer deliberated, or a tab left open over lunch. The
   * server refuses either way; this is what makes it a sentence instead of a failure.
   */
  | "pastStart";

/**
 * A rejected slot: why, and which existing booking says so.
 *
 * The clashing booking travels with the reason because the message has to name
 * the salon the customer is *already* booked at — which is usually not the salon
 * they are currently looking at.
 *
 * `clash` is **null for `pastStart`**: nothing is in the way there, the time has
 * simply gone.
 */
export type SlotBlock = { reason: BookingBlock; clash: Booking | null };

/**
 * Check a candidate slot against the clock and the customer's own upcoming bookings.
 *
 * `existing` should be the customer's bookings; anything not pending or
 * confirmed is ignored, so a cancelled appointment never blocks a rebooking —
 * which is exactly when someone books again.
 *
 * `businessId` no longer narrows the day rule (it spans salons) but stays in the
 * signature: callers pass it, and a future per-salon exception would need it.
 *
 * `now` is passed in rather than read here, the same way `travelWarning` takes it: this
 * module is pure, and two things deciding the same render must not disagree about the
 * time.
 */
export function blockForSlot({
  existing,
  start,
  durationMin,
  now,
}: {
  existing: Booking[];
  businessId?: string;
  start: Date;
  durationMin: number;
  now: Date;
}): SlotBlock | null {
  const end = new Date(start.getTime() + durationMin * 60_000);
  const candidateDay = thimphuDayOf(start).getTime();

  /*
    First, because the server checks it first and for the same reason: "that time has
    already passed" is the useful answer, and a slot in the past would otherwise be
    reported as whatever else it happens to collide with. No grace period — `create_booking`
    compares against a bare `now()`, so pretending a minute is still available would be
    inventing a slot the server refuses.
  */
  if (start.getTime() < now.getTime()) {
    return { reason: "pastStart", clash: null };
  }

  for (const b of existing) {
    if (b.status !== "pending" && b.status !== "confirmed") continue;

    // Half-open ranges: a booking that ends exactly when this one starts is
    // back-to-back, not a clash.
    if (b.startTs < end && b.endTs > start) {
      return { reason: "overlapsExisting", clash: b };
    }

    // Any salon — a live booking closes the whole Thimphu day.
    if (thimphuDayOf(b.startTs).getTime() === candidateDay) {
      return { reason: "alreadyBookedThatDay", clash: b };
    }
  }
  return null;
}

/**
 * The customer-facing sentence for a block.
 *
 * `salonName` is the salon of the *clashing* booking, not the one being booked.
 */
export function bookingBlockMessage(
  block: BookingBlock,
  salonName?: string | null,
): string {
  switch (block) {
    case "overlapsExisting":
      return "You already have a booking at that time. Cancel it first, or pick another slot.";
    case "alreadyBookedThatDay": {
      const where = salonName ?? "another salon";
      return `You already have a booking at ${where} that day. Cancel it first, or pick another day.`;
    }
    case "pastStart":
      // The same words `bookingFailureMessage` gives P0016 upstream, so the client's
      // pre-check and the server's refusal read identically.
      return "That time has already passed. Pick a later slot.";
  }
}

/* --------------------------------------------------------------------------
   The salon's cancellation window.
   -------------------------------------------------------------------------- */

/** When free cancellation and self-service changes close, and whether they have. */
export type CancellationWindow = { freeUntil: Date; closed: boolean };

/**
 * What `businesses.cancellation_window_hours` allows for one booking.
 *
 * Until `20260807000032_cancellation_window` this column was enforced **nowhere** — no
 * function in `public` or `private` referenced it. Both clients rendered *"Free cancellation
 * has closed for this booking"* and put a working Cancel button directly beneath it, so a
 * salon setting 12 hours changed one sentence and nothing else, and a Nu 1,700 colour could be
 * dropped ten minutes before, free and unrecorded. `cancel_booking` and `reschedule_booking`
 * now both raise **P0015** past the cutoff.
 *
 * Three properties, each a case in `../tho/app/test/cancellation_window_test.dart`:
 *
 * - **Reschedule closes with cancellation.** The RPC measures the window against the
 *   **current** start — the commitment being broken — not the new one, because moving an
 *   appointment an hour before it starts costs the salon the same empty chair.
 * - **A window of 0 means the cutoff is the start time.** The natural reading of "no notice
 *   required", and the reason this compares with `>` rather than `>=`.
 * - **It fails open.** `windowHours` is null when the salon could not be read, and this
 *   returns null rather than assuming a default — there is no window to apply, and disabling
 *   on a failed read would strand a customer who could legitimately cancel. The server still
 *   refuses if they could not.
 *
 * A salon member is exempt server-side, so the salon can always act for a customer who
 * phones; only self-service closes.
 */
export function cancellationWindow({
  startTs,
  windowHours,
  now,
}: {
  startTs: Date;
  /** `businesses.cancellationWindowHours`, or null when the salon did not load. */
  windowHours: number | null | undefined;
  now: Date;
}): CancellationWindow | null {
  if (windowHours == null) return null;
  const freeUntil = new Date(startTs.getTime() - windowHours * 3_600_000);
  return { freeUntil, closed: now.getTime() > freeUntil.getTime() };
}

/**
 * The salon's cancellation rule, as one sentence, **before** the customer commits.
 *
 * A port of `cancellationNotice` in `../tho/app/lib/customer/booking_guards.dart:234`, which
 * upstream added on 2026-08-12 to close audit finding **A1-08**: the window was shown on no screen
 * in the booking flow — it first appeared on the confirmation sheet, i.e. after the booking
 * existed. That was survivable while the column was decorative. It stopped being survivable when
 * A1-02 gave the window teeth, because an unshown term became an **enforced** one:
 * `cancel_booking` and `reschedule_booking` both raise P0015 past the cutoff.
 *
 * Three things this deliberately gets right, all pinned by tests:
 *
 * - **Zero hours is "any time before your appointment"**, which is the migration's own reading of
 *   a zero window, and not "0 hours before" — a sentence that says nothing while looking like a
 *   rule.
 * - **Whole days are said in days.** 24 and 48 are the two values an owner actually picks, and
 *   "up to 2 days before" is what they would say out loud.
 * - **It quotes the same number the refusal does.** `cancellationWindow` computes the cutoff from
 *   the same column, so the notice shown beforehand and the P0015 message shown afterwards cannot
 *   disagree — the upstream test exists for exactly that, since disagreeing about it is how a
 *   customer ends up feeling misled rather than informed.
 *
 * It takes a plain `number` rather than the nullable column: `businesses.cancellation_window_hours`
 * is `not null` with a default, and `toBusiness` falls back to 12, so a caller inside the booking
 * flow always has a figure. The null case belongs to `cancellationWindow`, where it means "the
 * salon did not load" and has to fail open.
 *
 * **Every surface that quotes the window goes through here or through `changeWindowNotice`.** The
 * three cases above are only fixed where the helper is actually called: while this shipped, the
 * confirmation sheet and the reschedule page still interpolated the raw column, so the same salon
 * said "up to 1 day before" in the wizard and "up to 24 hours before" on the sheet a minute later,
 * and a one-hour window read "up to 1 hours before" on both.
 */
export function cancellationNotice(hours: number): string {
  const phrase = windowPhrase(hours);
  return phrase
    ? `Free cancellation up to ${phrase} before.`
    : "Free cancellation any time before your appointment.";
}

/**
 * The same window, in the sentence a **closed** one needs.
 *
 * `/bookings/[id]/reschedule` states the rule after refusing to offer times, where "free
 * cancellation" would be the wrong half of it — the customer is trying to *move* the booking, and
 * what they need is the salon's cutoff for changes and the fact that a phone call still works. So
 * it is a different sentence built on the same phrase, rather than the same sentence reused: the
 * only thing the two must never disagree about is the number, and `windowPhrase` is why they
 * cannot.
 */
export function changeWindowNotice(salonName: string, hours: number): string {
  const phrase = windowPhrase(hours);
  return phrase
    ? `${salonName} takes changes up to ${phrase} before an appointment.`
    : `${salonName} takes changes right up to the appointment.`;
}

/**
 * The window as a duration — "1 hour", "12 hours", "2 days" — or null for a window with no
 * duration to name.
 *
 * Null rather than "0 hours" is the whole point, and it is the migration's own reading: a zero
 * window is not a rule measured in zero, it is the absence of a cutoff, and each caller says that
 * in its own words. Whole days are said in days because 24 and 48 are the two values an owner
 * actually picks.
 */
function windowPhrase(hours: number): string | null {
  if (hours <= 0) return null;
  if (hours === 1) return "1 hour";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "1 day" : `${days} days`;
  }
  return `${hours} hours`;
}

/* --------------------------------------------------------------------------
   Travel feasibility — stopping someone booking a slot they cannot reach.
   -------------------------------------------------------------------------- */

/** Straight-line kilometres between two points. */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * A rough travel time in minutes for a distance on Bhutanese roads.
 *
 * Deliberately pessimistic and deliberately not a routing API: 25 km/h is about
 * right for Thimphu traffic and mountain roads, and the point is to stop someone
 * booking a slot they cannot physically reach — not to promise an arrival time.
 * A real routing service would be a better number and a worse trade (a key, a
 * quota, and a network call on every slot list).
 */
export function travelMinutesFor(km: number): number {
  return Math.min(24 * 60, Math.max(1, Math.ceil((km / 25) * 60)));
}

/** "1.2 km away" / "340 m away". */
export function distanceLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

/** Whether a slot is realistically reachable from `km` away, given `now`. */
export function isSlotReachable({
  km,
  start,
  now,
}: {
  km: number;
  start: Date;
  now: Date;
}): boolean {
  const remainingMin = (start.getTime() - now.getTime()) / 60_000;
  if (remainingMin < 0) return false;
  return remainingMin >= travelMinutesFor(km);
}

/** The warning to show beside an unreachable slot, or null when it is fine. */
export function travelWarning({
  km,
  start,
  now,
}: {
  km: number | null;
  start: Date;
  now: Date;
}): string | null {
  if (km == null) return null;
  // Under 2 km nothing is worth warning about — you can walk it.
  if (km < 2) return null;
  if (isSlotReachable({ km, start, now })) return null;

  const mins = travelMinutesFor(km);
  const travel =
    mins >= 60
      ? `${(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)} hr`
      : `${mins} min`;
  return `You're ${distanceLabel(km)} — that's about ${travel} of travel. This slot may be too soon.`;
}

/** Re-exported so callers don't have to reach into `./time` for the offset. */
export { THIMPHU_OFFSET_MIN };
