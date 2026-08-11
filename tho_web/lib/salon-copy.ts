import {
  minutesOfDay,
  thimphuDayOf,
  thimphuMinutesOfDay,
  thimphuWeekday,
} from "./time";
import type { WorkingHour } from "./types/booking";
import { travels, type Business } from "./types/salon";

/**
 * The one-line facts on a salon page, kept here rather than inline in the
 * component because each of them can quietly *lie* if it is wrong, and none has
 * live data to catch it.
 *
 * Ported from `_coverageLine` and `_todayLine` in
 * `tho/app/lib/customer/business_detail_screen.dart:147` and `:237`.
 */

/**
 * "Comes to you" / "Travels up to 10 km to you".
 *
 * A travelling stylist gets this **instead of** a shopfront address: printing
 * "Norzin Lam" for someone who comes to you sends the customer to a building that
 * has nothing to do with them.
 *
 * Zero live businesses are `home_based` or `mobile` today, so this branch is
 * unreachable in the smoke test and is covered by unit tests instead.
 */
export function coverageLine(b: Pick<Business, "serviceRadiusKm">): string {
  const km = b.serviceRadiusKm;
  if (km == null) return "Comes to you";
  const n = Number.isInteger(km) ? String(km) : km.toFixed(1);
  return `Travels up to ${n} km to you`;
}

/** True when the salon should show a coverage line rather than an address. */
export function showsCoverage(b: Pick<Business, "businessType">): boolean {
  return travels(b);
}

/** `09:00:00` → `09:00`. The DB stores seconds; nobody reads them. */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "";
}

/**
 * "Open today · 09:00 – 18:00", "Opens 14:00 today", or "Closed today".
 *
 * **Judged in Thimphu time, not the viewer's.** The Dart reads `DateTime.now()`
 * locally, which is sound on a phone in Bhutan and wrong in a browser that can be
 * anywhere: at 23:00 UTC it is already tomorrow in Thimphu, so a device-local
 * weekday would read the wrong row of `business_hours` and tell a customer in
 * London that a shop is open when it shut five hours ago. Same divergence, and same
 * reason, as `availabilityScoreFromHours` in `recommendations.ts`.
 *
 * The app also only ever shows the *first* segment for the day. Kept: a salon with a
 * lunch break stores two rows, and "09:00 – 12:00" is true even if incomplete,
 * whereas spanning the gap ("09:00 – 18:00") would not be.
 */
export function todayHoursLine(hours: WorkingHour[], now = new Date()): string {
  const dow = thimphuWeekday(thimphuDayOf(now));
  const today = hours
    .filter((h) => h.dayOfWeek === dow)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (today.length === 0) return "Closed today";

  const nowMin = thimphuMinutesOfDay(now);
  const open = today.find(
    (h) => nowMin >= minutesOfDay(h.startTime) && nowMin < minutesOfDay(h.endTime),
  );
  if (open) return `Open today · ${hhmm(open.startTime)} – ${hhmm(open.endTime)}`;

  const later = today.find((h) => minutesOfDay(h.startTime) > nowMin);
  if (later) return `Opens ${hhmm(later.startTime)} today`;

  return `Closed now · opened ${hhmm(today[0]!.startTime)}`;
}
