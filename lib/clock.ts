/**
 * How a time of day reads, in one place.
 *
 * A port of `../tho/app/lib/data/clock.dart`, written in the same spirit as `formatNu`: one
 * place decides how a time reads, so a booking, a chat message, an order receipt and a
 * salon's opening hours cannot drift into four different conventions. Before this there were
 * **seventeen** call sites in this repo, each with its own `toLocaleString` options.
 *
 * **Times read as 12-hour with an uppercase marker.** Bhutan reads the clock the way it
 * speaks it — "two o'clock", not "fourteen hundred". The customer-facing slot pickers had
 * already gone 12-hour on their own (`formatMinutes12`); everything else was 24-hour, so the
 * same appointment was "2:00 PM" on one screen and "14:00" on the next.
 *
 * **Formatted by hand, not by a locale's own time format**, which is the decision upstream
 * arrived at and it is worth keeping: `Intl`'s day-period text depends on the locale, this
 * product runs as `en-BT`, and the marker's case and spacing then depend on which locale the
 * runtime falls back to. These are the times somebody reads to decide when to leave the
 * house. Anything with a **date** in it still goes through `Intl`, where the locale's month
 * and weekday names are exactly what is wanted.
 *
 * **Everything here renders in Thimphu time by default.** The device's timezone is not
 * evidence about when a salon opens, and a visitor reading the site from another country must
 * still see the salon's clock. That is also the A1-11 defect upstream keeps citing — and note
 * `booking_confirmed_sheet.dart` and `booking_rich_card.dart` upstream still use
 * `DateFormat('h:mm a')` over `.toLocal()`, so they have both halves of the problem this file
 * avoids. Do not port that pair.
 */

import { THIMPHU_TZ } from "./time";

/**
 * `2:00 PM` · `9:05 AM` · `12:00 AM` (midnight) · `12:00 PM` (noon).
 *
 * No leading zero on the hour, always two digits of minute, one space, an uppercase marker.
 */
export function timeLabel(instant: Date, timeZone: string = THIMPHU_TZ): string {
  const { hour, minute } = hourMinuteIn(instant, timeZone);
  return label12(hour, minute);
}

/**
 * A `HH:mm` or `HH:mm:ss` clock string — the shape a Postgres `time` column arrives in — as a
 * 12-hour label. Returns the input unchanged when it is not a time, so a malformed row shows
 * the raw value rather than a wrong one.
 *
 * This is the opening-hours path: `business_hours.open_time` is a string and never an
 * instant, so it has no date to be read in a timezone and must not be given an invented one.
 */
export function clockLabel(hhmm: string): string {
  const parts = hhmm.split(":");
  if (parts.length < 2) return hhmm;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return hhmm;
  }
  return label12(h, m);
}

/** `Wed 3 Sep · 2:00 PM` — the compact stamp on a booking card or a list row. */
export function dayTimeLabel(instant: Date, timeZone: string = THIMPHU_TZ): string {
  return `${datePart(instant, timeZone, "compact")} · ${timeLabel(instant, timeZone)}`;
}

/** `Wednesday 3 Sep 2026 · 2:00 PM` — a detail screen, where the appointment is the page. */
export function fullDayTimeLabel(instant: Date, timeZone: string = THIMPHU_TZ): string {
  return `${datePart(instant, timeZone, "full")} · ${timeLabel(instant, timeZone)}`;
}

/**
 * `3 Sep · 2:00 PM` — a dated stamp with no weekday, for lists of records (payments, order
 * events) where the day of the week carries nothing.
 */
export function dateTimeLabel(instant: Date, timeZone: string = THIMPHU_TZ): string {
  return `${datePart(instant, timeZone, "dateOnly")} · ${timeLabel(instant, timeZone)}`;
}

/** `9:00 AM – 6:00 PM` from two clock strings. An en dash, not a hyphen — it is a range. */
export function hoursLabel(start: string, end: string): string {
  return `${clockLabel(start)} – ${clockLabel(end)}`;
}

/* -------------------------------------------------------------------------- */

function label12(hour24: number, minute: number): string {
  // `hour24 % 12` is 0 at both midnight and noon, and those are the two the arithmetic gets
  // wrong if you let it: each is "12", not "0", and they take different markers.
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const marker = hour24 < 12 ? "AM" : "PM";
  return `${h}:${String(minute).padStart(2, "0")} ${marker}`;
}

/**
 * The wall-clock hour and minute of an instant in a given zone.
 *
 * `hourCycle: "h23"` is what makes this safe to do arithmetic on: without it midnight can
 * come back as `24`, and the caller cannot tell that from noon.
 */
function hourMinuteIn(instant: Date, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { hour: value("hour"), minute: value("minute") };
}

/**
 * The date half, assembled from parts.
 *
 * **Assembled rather than formatted whole**, because `en-GB` punctuates a weekday with a
 * comma — "Wed, 3 Sep" — and the app's stamp has none. These strings are user-facing copy
 * that both clients are meant to share, so the separator is a decision rather than a default.
 *
 * **And `en-US`, not `en-GB`, for one reason: `en-GB` abbreviates September as "Sept".** Four
 * letters, for exactly one month of the year, where the other eleven get three — and Dart's
 * `DateFormat('d MMM')` upstream gives "Sep", so the two clients would disagree about the
 * current month. The order is assembled here rather than taken from the locale, so US date
 * order never reaches the output.
 */
function datePart(instant: Date, timeZone: string, shape: "compact" | "full" | "dateOnly"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: shape === "full" ? "long" : shape === "compact" ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: shape === "full" ? "numeric" : undefined,
  }).formatToParts(instant);

  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = value("weekday");
  const stamp = [value("day"), value("month"), value("year")].filter(Boolean).join(" ");
  return weekday ? `${weekday} ${stamp}` : stamp;
}
