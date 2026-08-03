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
  | "alreadyBookedThatDay";

/**
 * A rejected slot: why, and which existing booking says so.
 *
 * The clashing booking travels with the reason because the message has to name
 * the salon the customer is *already* booked at — which is usually not the salon
 * they are currently looking at.
 */
export type SlotBlock = { reason: BookingBlock; clash: Booking };

/**
 * Check a candidate slot against the customer's own upcoming bookings.
 *
 * `existing` should be the customer's bookings; anything not pending or
 * confirmed is ignored, so a cancelled appointment never blocks a rebooking —
 * which is exactly when someone books again.
 *
 * `businessId` no longer narrows the day rule (it spans salons) but stays in the
 * signature: callers pass it, and a future per-salon exception would need it.
 */
export function blockForSlot({
  existing,
  start,
  durationMin,
}: {
  existing: Booking[];
  businessId?: string;
  start: Date;
  durationMin: number;
}): SlotBlock | null {
  const end = new Date(start.getTime() + durationMin * 60_000);
  const candidateDay = thimphuDayOf(start).getTime();

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
  }
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
