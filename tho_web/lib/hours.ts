import {
  formatMinutesOfDay,
  minutesOfDay,
  thimphuDayOf,
  thimphuMinutesOfDay,
  thimphuWeekday,
} from "./time";
import type { Booking, WorkingHour } from "./types/booking";

/**
 * The weekly hours model, ported from
 * `tho/app/lib/business/hours/hours_model.dart`, with its tests
 * (`working_hours_model_test.dart` → `hours.test.ts`).
 *
 * Two editors share it, and they do **different jobs** — worth knowing before touching
 * either. `private.is_bookable_window` reads `businesses.timezone`, then
 * `staff_working_hours` and `staff_time_off`, and **never `business_hours`**. So:
 *
 * - **A stylist's hours gate bookings.** `compute_availability` and `create_booking` both
 *   refuse anything that does not fit inside one interval row.
 * - **A salon's opening hours gate nothing.** They drive the salon page's hours line, the
 *   owner calendar's closed days and `% booked`, and the discover ranking. Nothing more.
 *
 * Weekdays are 0=Sunday…6=Saturday, matching both tables' `day_of_week`. Times are
 * minutes-of-day in here and `'HH:MM:SS'` at the API boundary.
 *
 * **A lunch break is not stored — it is the GAP between two segments.** The booking engine
 * already refuses a booking that does not sit entirely inside one interval, so a gap is
 * unbookable for free, with no column to add and no rule to keep in step.
 *
 * **One deliberate divergence from the Dart: 24-hour display.** `hours_model.dart` has
 * `formatMinutes12` ("8:30 am") for the design mock. Every other time in `tho_web` is
 * `HH:MM` — slot chips, the calendar, `formatMinutesOfDay` — and `<input type="time">`,
 * which stands in for Flutter's `showTimePicker`, both reads and writes 24-hour. A gap pill
 * reading "1:00 pm" beside an input reading "13:00" would be worse than diverging from the
 * mock, so `formatMinutesOfDay` from `lib/time.ts` is used throughout and
 * `formatMinutes12` is not ported. Its three test cases port as 24-hour equivalents,
 * including the 1440 end-of-day boundary.
 */

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * One bookable stretch on one weekday.
 *
 * `enabled` is **editor-only state**: a disabled segment is never persisted, which is how
 * a greyed-out row works without an `enabled` column in either table.
 */
export type Segment = {
  startMin: number;
  endMin: number;
  enabled: boolean;
};

/** A break between two consecutive enabled segments. `index` is the segment it follows. */
export type Gap = {
  startMin: number;
  endMin: number;
  index: number;
};

export type DayHours = {
  dayOfWeek: number;
  segments: Segment[];
};

/** Always length 7; the index **is** the `day_of_week`. */
export type WeekHours = DayHours[];

/** One interval as `set_staff_working_hours` wants it. */
export type IntervalPayload = { day: number; start: string; end: string };

export function segment(startMin: number, endMin: number, enabled = true): Segment {
  return { startMin, endMin, enabled };
}

/** `'08:30:00'` from minutes-from-midnight. Seconds are always `00`. */
export function hmsFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** Re-exported under the Dart's name so the two files read alike side by side. */
export const minutesFromHms = minutesOfDay;

/**
 * Closing time, as minutes from the start of the day. `24:00:00` is a valid Postgres
 * `time` and `hmsFromMinutes(1440)` produces it, so a stylist really can work until
 * midnight.
 */
export const END_OF_DAY_MIN = 24 * 60;

/**
 * What `<input type="time">` shows for a stretch's **end**.
 *
 * `24:00` is not a value the control accepts — it rejects it and renders empty — so a
 * stylist whose day closes at midnight would have appeared to have no closing time at all,
 * and the first edit to any other field would have written 23:59 back. That is not cosmetic:
 * `20260807000036_bookable_window_midnight` exists so a 22:30–24:00 booking fits, and an end
 * of 1439 is the one minute that stops it fitting. Losing the last slot of every late day
 * silently is the same defect from the other side.
 *
 * So midnight is written `00:00` on the end field — which is what it is, the hour the day
 * closes at — and {@link endMinutesFromInput} reads it back as 1440. The editor labels it, so
 * the convention is stated rather than hidden. Everywhere else 1440 formats as `24:00`
 * (see {@link formatSegment}), which is the right reading for a human and impossible for the
 * control.
 */
export function endInputValue(minutes: number): string {
  return minutes === END_OF_DAY_MIN ? "00:00" : formatMinutesOfDay(minutes);
}

/**
 * Minutes for a value typed into a stretch's **end** field — the inverse of
 * {@link endInputValue}.
 *
 * `00:00` means the end of the day, never the start of it: a stretch ending the instant it
 * could begin is not something an owner can mean, and `dayHasOverlap` rejects it as inverted
 * anyway, so the reading loses nothing and gains the only expression of midnight the control
 * has.
 */
export function endMinutesFromInput(value: string): number {
  const minutes = minutesOfDay(value);
  return minutes === 0 ? END_OF_DAY_MIN : minutes;
}

export function emptyWeek(): WeekHours {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, segments: [] }));
}

export function weekFromWorkingHours(rows: WorkingHour[]): WeekHours {
  const week = emptyWeek();
  for (const row of rows) {
    if (row.dayOfWeek < 0 || row.dayOfWeek > 6) continue;
    week[row.dayOfWeek]!.segments.push(
      segment(minutesFromHms(row.startTime), minutesFromHms(row.endTime)),
    );
  }
  for (const day of week) day.segments.sort((a, b) => a.startMin - b.startMin);
  return week;
}

export function withDay(week: WeekHours, day: DayHours): WeekHours {
  const next = [...week];
  next[day.dayOfWeek] = day;
  return next;
}

export function withSegments(day: DayHours, segments: Segment[]): DayHours {
  return { dayOfWeek: day.dayOfWeek, segments };
}

/** Enabled segments only, sorted by start time. */
export function enabledSegments(day: DayHours): Segment[] {
  return day.segments.filter((s) => s.enabled).sort((a, b) => a.startMin - b.startMin);
}

export function dayIsUnavailable(day: DayHours): boolean {
  return enabledSegments(day).length === 0;
}

/**
 * True when any enabled segment is inverted or overlaps another. Touching endpoints
 * (`a.end === b.start`) are fine — that is a zero-length break, not an overlap, and
 * `set_staff_working_hours` uses the same strict inequality.
 */
export function dayHasOverlap(day: DayHours): boolean {
  const list = enabledSegments(day);
  if (list.some((s) => s.endMin <= s.startMin)) return true;
  for (let i = 1; i < list.length; i++) {
    if (list[i]!.startMin < list[i - 1]!.endMin) return true;
  }
  return false;
}

export function gapsFor(day: DayHours): Gap[] {
  const list = enabledSegments(day);
  const out: Gap[] = [];
  for (let i = 1; i < list.length; i++) {
    if (list[i]!.startMin > list[i - 1]!.endMin) {
      out.push({ startMin: list[i - 1]!.endMin, endMin: list[i]!.startMin, index: i - 1 });
    }
  }
  return out;
}

export function weekHasErrors(week: WeekHours): boolean {
  return week.some(dayHasOverlap);
}

/**
 * The stretches a booking must fit **inside one of** — contiguous runs coalesced into one.
 *
 * `private.is_bookable_window` requires a booking to fit entirely within a single
 * `staff_working_hours` row, so `09:00–18:00` + `18:00–19:00` was not a 9-to-7 day: it was
 * two days, and a 90-minute service could start no later than 16:30 in the first and never
 * at all in the second. `20260807000034_merge_touching_working_hours` fixed that by
 * coalescing touching runs before insert, so **the stored shape is not always the shape the
 * editor holds** — and anything here reasoning about what is bookable has to reason about
 * the stored one.
 *
 * A port of that migration's gaps-and-islands grouping, and the running maximum is the part
 * that matters: the SQL compares against `max(end) over (… unbounded preceding …)`, not
 * against the previous row's end, so `09:00–18:00` + `10:00–11:00` + `11:00–12:00` is one
 * island rather than two. Comparing with the immediate predecessor gets the two-segment case
 * right and the nested case wrong.
 *
 * **A strict gap is untouched**, which is the whole lunch mechanism: `11:00`/`12:00` fails
 * `start <= runningMaxEnd` and starts a new island, and a booking straddling it stays
 * refused.
 *
 * This is not the client claiming authority — the server merges whatever it is sent. It is
 * so `weekToPayload` sends the shape that will exist and `bookingsOutsideHours` warns about
 * the day that will exist.
 */
export function bookableStretches(day: DayHours): Segment[] {
  const sorted = enabledSegments(day).sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
  );
  const out: Segment[] = [];
  // The SQL's window has no preceding row for the first segment, so `st <= max(end)` is
  // NULL there and the CASE falls through to "new island". `-Infinity` is that.
  let runningMaxEnd = Number.NEGATIVE_INFINITY;
  for (const s of sorted) {
    const island = out[out.length - 1];
    if (island && s.startMin <= runningMaxEnd) {
      island.endMin = Math.max(island.endMin, s.endMin);
    } else {
      out.push({ ...s });
    }
    runningMaxEnd = Math.max(runningMaxEnd, s.endMin);
  }
  return out;
}

/**
 * The complete weekly set for `set_staff_working_hours`. Disabled segments are omitted, so
 * an all-disabled week yields an empty array — which **clears** the hours, deliberately.
 *
 * Contiguous stretches are coalesced first, so what is sent is what will be stored. See
 * {@link bookableStretches}.
 */
export function weekToPayload(week: WeekHours): IntervalPayload[] {
  return week.flatMap((day) =>
    bookableStretches(day).map((s) => ({
      day: day.dayOfWeek,
      start: hmsFromMinutes(s.startMin),
      end: hmsFromMinutes(s.endMin),
    })),
  );
}

/**
 * Split the enabled segment at `segmentIndex` around a break, producing the two-segment
 * shape that makes the gap unbookable. The break must lie strictly inside the segment so
 * neither resulting side is zero-length.
 *
 * Throws with a sentence the editor shows as-is — the same contract as the Dart's
 * `ArgumentError`, whose message ends up in a snackbar.
 */
export function splitForLunch(
  day: DayHours,
  segmentIndex: number,
  breakStartMin: number,
  breakEndMin: number,
): DayHours {
  const list = enabledSegments(day);
  const seg = list[segmentIndex];
  if (!seg) throw new Error("There is no stretch to split there.");
  if (breakEndMin <= breakStartMin) throw new Error("The break must end after it starts.");
  if (breakStartMin <= seg.startMin || breakEndMin >= seg.endMin) {
    throw new Error(
      `The break has to sit inside ${formatSegment(seg)}, with time left on both sides.`,
    );
  }
  return withSegments(day, [
    ...list.flatMap((s, i) =>
      i === segmentIndex
        ? [
            { ...seg, endMin: breakStartMin },
            { ...seg, startMin: breakEndMin },
          ]
        : [s],
    ),
    ...day.segments.filter((s) => !s.enabled),
  ]);
}

/** Merge the two enabled segments either side of `gapIndex` back into one. */
export function mergeGap(day: DayHours, gapIndex: number): DayHours {
  const gap = gapsFor(day)[gapIndex];
  if (!gap) throw new Error("There is no break there to remove.");
  const after = gap.index;
  const list = enabledSegments(day);
  return withSegments(day, [
    ...list.flatMap((s, i) => {
      if (i === after) return [{ ...s, endMin: list[i + 1]!.endMin }];
      if (i === after + 1) return [];
      return [s];
    }),
    ...day.segments.filter((s) => !s.enabled),
  ]);
}

/** Replace each of `targetDays`'s segments with a copy of `sourceDay`'s. */
export function copyDay(
  week: WeekHours,
  sourceDay: number,
  targetDays: Iterable<number>,
): WeekHours {
  let out = week;
  const source = week[sourceDay]?.segments ?? [];
  for (const d of targetDays) {
    if (d === sourceDay || d < 0 || d > 6) continue;
    // `dayOfWeek` is rewritten, not copied — the segments move, the weekday does not.
    out = withDay(out, { dayOfWeek: d, segments: source.map((s) => ({ ...s })) });
  }
  return out;
}

/**
 * Weekdays the shop is open, from its `business_hours` rows. A business with no hours at
 * all returns every weekday: without this, an unseeded salon would render seven
 * "Unavailable" days in the staff editor and lock the owner out of setting any hours.
 */
export function openWeekdaysFrom(businessHours: WorkingHour[]): Set<number> {
  if (businessHours.length === 0) return new Set([0, 1, 2, 3, 4, 5, 6]);
  return new Set(businessHours.map((h) => h.dayOfWeek));
}

/**
 * How many upcoming bookings would no longer fit inside `week`.
 *
 * Changing hours never invalidates an existing booking — `is_bookable_window` only runs at
 * create and reschedule time — so this is what warns an owner before they save a lunch
 * break straight across a confirmed appointment.
 *
 * Two things make this agree with `private.is_bookable_window` rather than merely resemble
 * it, and both are load-bearing:
 *
 * - It judges against {@link bookableStretches}, not the raw segments, because the server
 *   coalesces contiguous runs on save. Without that, an owner extending a day with a second
 *   touching stretch would be warned that every long booking across the join no longer fits
 *   — about a day that, once saved, contains all of them.
 * - `endMin` is an **offset from the start of the local day**, so a booking running to
 *   midnight has an end of exactly 1440 and fits a stretch closing at 24:00. That is the
 *   comparison `20260807000036_bookable_window_midnight` moved the SQL to, and it is why a
 *   booking overrunning midnight (1470) still does not fit anything.
 */
export function bookingsOutsideHours(
  bookings: Booking[],
  week: WeekHours,
  now: Date,
): number {
  let count = 0;
  for (const b of bookings) {
    if (b.status !== "pending" && b.status !== "confirmed") continue;
    if (b.startTs.getTime() <= now.getTime()) continue;

    const startMin = thimphuMinutesOfDay(b.startTs);
    const endMin = startMin + (b.endTs.getTime() - b.startTs.getTime()) / 60_000;
    const dow = thimphuWeekday(thimphuDayOf(b.startTs));
    const fits = bookableStretches(week[dow]!).some(
      (s) => startMin >= s.startMin && endMin <= s.endMin,
    );
    if (!fits) count++;
  }
  return count;
}

/** `09:00 – 18:00`, for a gap pill, a closed-day summary or the split error above. */
export function formatSegment(s: Pick<Segment, "startMin" | "endMin">): string {
  return `${formatMinutesOfDay(s.startMin)} – ${formatMinutesOfDay(s.endMin)}`;
}
