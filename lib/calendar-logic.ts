import type { Booking, WorkingHour } from "./types/booking";
import { minutesOfDay, thimphuDayBoundsUtc, addDays } from "./time";

/**
 * Pure calendar math, ported from `tho/app/lib/business/calendar/calendar_logic.dart`.
 *
 * No React, no Supabase — so the rules can be tested directly. Every "day"
 * argument is a Thimphu calendar day (UTC+6, no DST): only its y/m/d matter.
 * Bookings carry UTC timestamps.
 *
 * The Dart original is covered by `tho/app/test/calendar_logic_test.dart`; the
 * TypeScript tests port those exact cases, because a silent off-by-one in day
 * bounds would corrupt every calendar view on both platforms differently.
 */

/** A booking counts toward a day's stats unless it was cancelled or a no-show. */
export function isActiveBooking(b: Pick<Booking, "status">): boolean {
  return b.status !== "cancelled" && b.status !== "no_show";
}

/** Total booked minutes (end − start) across bookings, active ones only. */
export function bookedMinutesOnDay(bookings: Booking[]): number {
  let total = 0;
  for (const b of bookings) {
    if (!isActiveBooking(b)) continue;
    total += Math.round((b.endTs.getTime() - b.startTs.getTime()) / 60_000);
  }
  return total;
}

/** A human "in 15 min" / "in 2 h" / "in 2 h 5 min" / "now" countdown label. */
export function countdownLabel(untilMs: number): string {
  const totalMinutes = Math.floor(untilMs / 60_000);
  if (totalMinutes <= 0) return "now";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `in ${m} min`;
  if (m === 0) return `in ${h} h`;
  return `in ${h} h ${m} min`;
}

/** Whether a UTC instant falls inside a Thimphu day's half-open bounds. */
function fallsOn(instant: Date, day: Date): boolean {
  const { from, to } = thimphuDayBoundsUtc(day);
  return instant >= from && instant < to;
}

/**
 * Active-booking counts for each of the 7 Thimphu days from `weekStart`
 * (index 0 === weekStart). Uses the same bounds helper as the day reads, so a
 * week header count and its listed bookings can never disagree.
 */
export function perDayCounts(weekBookings: Booking[], weekStart: Date): number[] {
  return groupWeekByDay(weekBookings, weekStart).map((g) => g.bookings.length);
}

/**
 * Buckets bookings into the 7 Thimphu days from `weekStart`, each ascending by
 * `startTs`. Empty days keep an empty list — the agenda still needs a slot to
 * say "No bookings" rather than the day silently vanishing.
 */
export function groupWeekByDay(
  weekBookings: Booking[],
  weekStart: Date,
): { day: Date; bookings: Booking[] }[] {
  const base = new Date(
    Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate(),
    ),
  );

  const groups: { day: Date; bookings: Booking[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(base, i);
    const bookings = weekBookings
      .filter((b) => isActiveBooking(b) && fallsOn(b.startTs, day))
      .sort((a, b) => a.startTs.getTime() - b.startTs.getTime());
    groups.push({ day, bookings });
  }
  return groups;
}

/**
 * Total open minutes on a weekday (0=Sun..6=Sat) from a business's hours.
 * `null` when the salon lists no hours that day — which means closed, and is
 * deliberately distinct from 0.
 */
export function openMinutesForWeekday(
  hours: WorkingHour[],
  weekdaySun0: number,
): number | null {
  let total = 0;
  let found = false;
  for (const h of hours) {
    if (h.dayOfWeek !== weekdaySun0) continue;
    found = true;
    total += minutesOfDay(h.endTime) - minutesOfDay(h.startTime);
  }
  return found ? total : null;
}

export type DayStats = {
  appointmentCount: number;
  nextUp: Booking | null;
  expectedTakings: number;
  /** 0..1, or null when openMinutes is null/0 — utilization can't be shown. */
  utilizationPct: number | null;
};

/**
 * Live day totals for the Today header. Pure: derived from a day's bookings and
 * the current instant, plus optional open-minutes for utilization.
 */
export function dayStats(
  dayBookings: Booking[],
  nowUtc: Date,
  openMinutes?: number | null,
): DayStats {
  let appointmentCount = 0;
  let expectedTakings = 0;
  let nextUp: Booking | null = null;

  for (const b of dayBookings) {
    if (!isActiveBooking(b)) continue;
    appointmentCount++;
    expectedTakings += b.totalPrice;
    if (b.startTs > nowUtc && (nextUp === null || b.startTs < nextUp.startTs)) {
      nextUp = b;
    }
  }

  let utilizationPct: number | null = null;
  if (openMinutes != null && openMinutes > 0) {
    utilizationPct = Math.min(
      1,
      Math.max(0, bookedMinutesOnDay(dayBookings) / openMinutes),
    );
  }

  return { appointmentCount, nextUp, expectedTakings, utilizationPct };
}
