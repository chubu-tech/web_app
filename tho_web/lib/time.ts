/**
 * Thimphu time.
 *
 * Bhutan is a single zone, `Asia/Thimphu`, UTC+6, and it has **no DST** — so a
 * fixed offset is exact here rather than an approximation, which is why the
 * Flutter app hardcodes `Duration(hours: 6)` in `booking_guards.dart:51` and
 * `calendar_logic.dart:10`. This file mirrors that constant.
 *
 * Do not reach for a timezone library. One would introduce DST handling the
 * database does not have, and the server compares with a plain
 * `at time zone 'Asia/Thimphu'`. Matching the backend exactly matters more than
 * generality the product will never use.
 */

/** Asia/Thimphu, in minutes east of UTC. */
export const THIMPHU_OFFSET_MIN = 6 * 60;

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * The half-open UTC bounds `[from, to)` of a Thimphu calendar day.
 *
 * A Thimphu day starts at 00:00+06:00, i.e. 18:00 UTC the previous day. Only the
 * y/m/d of `day` matter — any time-of-day on it is ignored.
 *
 * Pass `day` as a Thimphu calendar day. Use {@link thimphuToday} or
 * {@link thimphuDayOf} to get one; do not pass a raw local `Date` from a
 * visitor's browser, whose y/m/d may be a different calendar day.
 */
export function thimphuDayBoundsUtc(day: Date): { from: Date; to: Date } {
  const midnightUtc = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
  );
  const from = new Date(midnightUtc - THIMPHU_OFFSET_MIN * MS_PER_MIN);
  return { from, to: new Date(from.getTime() + MS_PER_DAY) };
}

/**
 * The Thimphu calendar day a UTC instant falls on, as a UTC-midnight `Date`.
 *
 * This is the canonical "which day is this?" — a 19:00 UTC booking is already
 * tomorrow in Thimphu, and every bucketing decision has to agree on that.
 */
export function thimphuDayOf(instant: Date): Date {
  const shifted = new Date(instant.getTime() + THIMPHU_OFFSET_MIN * MS_PER_MIN);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

/** Today in Thimphu, as a UTC-midnight `Date`. */
export function thimphuToday(now: Date = new Date()): Date {
  return thimphuDayOf(now);
}

/** `n` days after a Thimphu day, still a UTC-midnight `Date`. */
export function addDays(day: Date, n: number): Date {
  return new Date(day.getTime() + n * MS_PER_DAY);
}

/** Weekday of a Thimphu day, 0 = Sunday, matching `business_hours.day_of_week`. */
export function thimphuWeekday(day: Date): number {
  return day.getUTCDay();
}

/** `yyyy-mm-dd` for a Thimphu day — the form used in URLs and query params. */
export function toIsoDay(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** Parse `yyyy-mm-dd` back into a Thimphu day. */
export function fromIsoDay(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Minutes from midnight for a `HH:MM` or `HH:MM:SS` time-of-day string. */
export function minutesOfDay(hms: string): number {
  const parts = hms.split(":");
  const h = Number.parseInt(parts[0] ?? "", 10);
  const m = Number.parseInt(parts[1] ?? "", 10);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** The wall-clock minutes-from-midnight of a UTC instant, in Thimphu. */
export function thimphuMinutesOfDay(instant: Date): number {
  const shifted = new Date(instant.getTime() + THIMPHU_OFFSET_MIN * MS_PER_MIN);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** `09:00` from minutes-from-midnight. */
export function formatMinutesOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
