import { describe, expect, it } from "vitest";
import {
  bookingsOutsideHours,
  copyDay,
  dayHasOverlap,
  dayIsUnavailable,
  emptyWeek,
  enabledSegments,
  formatSegment,
  gapsFor,
  hmsFromMinutes,
  mergeGap,
  minutesFromHms,
  openWeekdaysFrom,
  segment,
  splitForLunch,
  weekFromWorkingHours,
  weekHasErrors,
  weekToPayload,
  withDay,
  type DayHours,
} from "./hours";
import { formatMinutesOfDay } from "./time";
import type { Booking, WorkingHour } from "./types/booking";

/**
 * A port of `../tho/app/test/working_hours_model_test.dart`, case for case.
 *
 * One group differs on purpose. The Dart's "12-hour display matches the mock" and
 * "1440 renders as 12:00 am" cases test `formatMinutes12`, which `lib/hours.ts`
 * deliberately does not port — every time in `tho_web` is 24-hour, because
 * `<input type="time">` reads and writes 24-hour and a mixed-clock row would be worse than
 * diverging from the mock. The same boundaries are asserted here against
 * `formatMinutesOfDay` instead, including 1440.
 */

const wh = (dow: number, start: string, end: string): WorkingHour => ({
  id: `wh-${dow}-${start}`,
  dayOfWeek: dow,
  startTime: start,
  endTime: end,
});

const bk = (status: Booking["status"], startUtc: Date, minutes: number): Booking => ({
  id: `bk-${startUtc.toISOString()}`,
  status,
  startTs: startUtc,
  endTs: new Date(startUtc.getTime() + minutes * 60_000),
  totalPrice: 300,
  staffMemberId: "s1",
  items: [],
});

const day = (dayOfWeek: number, segments: ReturnType<typeof segment>[]): DayHours => ({
  dayOfWeek,
  segments,
});

describe("time conversion", () => {
  it("hms parses to minutes-of-day and back", () => {
    expect(minutesFromHms("08:30:00")).toBe(510);
    expect(minutesFromHms("00:00:00")).toBe(0);
    expect(minutesFromHms("13:05")).toBe(785); // seconds are optional
    expect(hmsFromMinutes(510)).toBe("08:30:00");
    expect(hmsFromMinutes(0)).toBe("00:00:00");
    expect(hmsFromMinutes(1439)).toBe("23:59:00");
  });

  it("24-hour display, which is what the time inputs speak", () => {
    expect(formatMinutesOfDay(510)).toBe("08:30");
    expect(formatMinutesOfDay(660)).toBe("11:00");
    expect(formatMinutesOfDay(780)).toBe("13:00");
    expect(formatMinutesOfDay(930)).toBe("15:30");
    expect(formatMinutesOfDay(0)).toBe("00:00");
    expect(formatMinutesOfDay(720)).toBe("12:00");
  });

  it("1440 reads as end-of-day rather than wrapping to 00:00", () => {
    // The Dart's equivalent case exists because `formatMinutes12(1440)` had to say
    // "12:00 am" rather than the inverted-looking "12:00 pm". In 24 hours the honest
    // answer is 24:00, which is also the literal Postgres `time` value — and the editor
    // clamps its inputs to 23:59, so 1440 is unreachable through the UI either way.
    expect(formatMinutesOfDay(1440)).toBe("24:00");
    expect(hmsFromMinutes(1440)).toBe("24:00:00");
    expect(formatSegment({ startMin: 1410, endMin: 1440 })).toBe("23:30 – 24:00");
  });
});

describe("weekFromWorkingHours", () => {
  it("groups rows by weekday and sorts by start", () => {
    const week = weekFromWorkingHours([
      wh(1, "13:00:00", "15:30:00"),
      wh(1, "08:30:00", "11:00:00"),
      wh(3, "09:00:00", "17:00:00"),
    ]);
    expect(week.length).toBe(7);
    expect(week[1]!.segments.map((s) => s.startMin)).toEqual([510, 780]);
    expect(week[3]!.segments[0]!.endMin).toBe(1020);
    expect(dayIsUnavailable(week[0]!)).toBe(true);
  });

  it("round-trips to the RPC payload", () => {
    const week = weekFromWorkingHours([
      wh(1, "08:30:00", "11:00:00"),
      wh(1, "13:00:00", "15:30:00"),
    ]);
    expect(weekToPayload(week)).toEqual([
      { day: 1, start: "08:30:00", end: "11:00:00" },
      { day: 1, start: "13:00:00", end: "15:30:00" },
    ]);
  });

  it("empty week produces an empty payload", () => {
    expect(weekToPayload(emptyWeek())).toEqual([]);
    expect(emptyWeek().length).toBe(7);
  });
});

describe("payload excludes non-persisted state", () => {
  it("disabled segments are not saved", () => {
    const week = withDay(emptyWeek(), day(2, [segment(540, 1080, false)]));
    expect(weekToPayload(week)).toEqual([]);
    expect(dayIsUnavailable(week[2]!)).toBe(true);
  });

  it("a day mixing enabled and disabled saves only the enabled one", () => {
    const week = withDay(
      emptyWeek(),
      day(4, [segment(540, 720), segment(780, 1080, false)]),
    );
    expect(weekToPayload(week)).toEqual([{ day: 4, start: "09:00:00", end: "12:00:00" }]);
  });
});

describe("overlap detection", () => {
  it("overlapping enabled segments are an error", () => {
    const d = day(1, [segment(540, 720), segment(660, 900)]);
    expect(dayHasOverlap(d)).toBe(true);
    expect(weekHasErrors(withDay(emptyWeek(), d))).toBe(true);
  });

  it("exactly touching segments do not overlap", () => {
    const d = day(1, [segment(540, 720), segment(720, 900)]);
    expect(dayHasOverlap(d)).toBe(false);
    expect(gapsFor(d)).toEqual([]); // a zero-length gap is not a break
  });

  it("a disabled segment cannot cause an overlap error", () => {
    const d = day(1, [segment(540, 720), segment(660, 900, false)]);
    expect(dayHasOverlap(d)).toBe(false);
  });

  it("an inverted segment is an error", () => {
    expect(weekHasErrors(withDay(emptyWeek(), day(1, [segment(720, 540)])))).toBe(true);
  });
});

describe("gaps", () => {
  it("the gap between two segments is reported", () => {
    const gaps = gapsFor(day(1, [segment(510, 660), segment(780, 930)]));
    expect(gaps.length).toBe(1);
    expect(gaps[0]).toEqual({ startMin: 660, endMin: 780, index: 0 });
  });

  it("a single segment has no gaps", () => {
    expect(gapsFor(day(1, [segment(510, 930)]))).toEqual([]);
  });

  it("three segments report two gaps in order", () => {
    const gaps = gapsFor(day(1, [segment(480, 600), segment(660, 780), segment(840, 960)]));
    expect(gaps.map((g) => g.startMin)).toEqual([600, 780]);
    expect(gaps.map((g) => g.index)).toEqual([0, 1]);
  });
});

describe("splitForLunch", () => {
  it("splits one segment into two around the break", () => {
    const split = splitForLunch(day(1, [segment(510, 1020)]), 0, 720, 780);
    expect(split.segments.map((s) => s.startMin)).toEqual([510, 780]);
    expect(split.segments.map((s) => s.endMin)).toEqual([720, 1020]);
    expect(gapsFor(split)[0]!.startMin).toBe(720);
  });

  it("rejects a break that is not strictly inside the segment", () => {
    const d = day(1, [segment(510, 1020)]);
    expect(() => splitForLunch(d, 0, 480, 780)).toThrow();
    expect(() => splitForLunch(d, 0, 720, 1080)).toThrow();
    expect(() => splitForLunch(d, 0, 510, 780)).toThrow(); // zero-length left side
    expect(() => splitForLunch(d, 0, 720, 1020)).toThrow(); // zero-length right side
  });

  it("rejects an inverted or empty break", () => {
    const d = day(1, [segment(510, 1020)]);
    expect(() => splitForLunch(d, 0, 780, 720)).toThrow();
    expect(() => splitForLunch(d, 0, 720, 720)).toThrow();
  });

  it("names the stretch the break has to sit inside, since the editor shows it", () => {
    expect(() => splitForLunch(day(1, [segment(510, 1020)]), 0, 480, 780)).toThrow(
      /08:30 – 17:00/,
    );
  });
});

describe("mergeGap", () => {
  it("merging the gap restores one continuous segment", () => {
    const merged = mergeGap(day(1, [segment(510, 660), segment(780, 930)]), 0);
    expect(merged.segments.length).toBe(1);
    expect(merged.segments[0]!.startMin).toBe(510);
    expect(merged.segments[0]!.endMin).toBe(930);
    expect(gapsFor(merged)).toEqual([]);
  });

  it("split then merge is the identity", () => {
    const round = mergeGap(splitForLunch(day(1, [segment(510, 1020)]), 0, 720, 780), 0);
    expect(round.segments[0]!.startMin).toBe(510);
    expect(round.segments[0]!.endMin).toBe(1020);
  });

  it("merging the first of two gaps leaves the second intact", () => {
    const merged = mergeGap(
      day(1, [segment(480, 600), segment(660, 780), segment(840, 960)]),
      0,
    );
    expect(merged.segments.map((s) => s.startMin)).toEqual([480, 840]);
    expect(merged.segments[0]!.endMin).toBe(780);
    expect(gapsFor(merged).length).toBe(1);
  });
});

describe("copyDay", () => {
  it("replaces the target days and leaves the source alone", () => {
    const week = withDay(
      withDay(emptyWeek(), day(1, [segment(510, 660), segment(780, 930)])),
      day(5, [segment(600, 700)]),
    );
    const copied = copyDay(week, 1, [3, 5]);
    expect(copied[3]!.segments.map((s) => s.startMin)).toEqual([510, 780]);
    expect(copied[5]!.segments.map((s) => s.startMin)).toEqual([510, 780]);
    expect(copied[1]!.segments.map((s) => s.startMin)).toEqual([510, 780]);
    expect(dayIsUnavailable(copied[2]!)).toBe(true);
    expect(copied[3]!.dayOfWeek).toBe(3); // dayOfWeek is rewritten, not copied
  });

  it("copying onto the source day is a no-op", () => {
    const week = withDay(emptyWeek(), day(1, [segment(510, 660)]));
    expect(copyDay(week, 1, [1])[1]!.segments[0]!.startMin).toBe(510);
  });

  it("copies segments by value, so editing one day cannot move another", () => {
    // Not in the Dart suite, which relies on `copyWith`. Here the copy is a spread, and a
    // shared object reference would make the copy-to-days shortcut quietly wrong.
    const week = copyDay(withDay(emptyWeek(), day(1, [segment(510, 660)])), 1, [2]);
    week[1]!.segments[0]!.endMin = 999;
    expect(week[2]!.segments[0]!.endMin).toBe(660);
  });
});

describe("openWeekdaysFrom", () => {
  it("lists the weekdays the shop has hours for", () => {
    expect(openWeekdaysFrom([wh(1, "09:00:00", "17:00:00"), wh(2, "09:00:00", "17:00:00")])).toEqual(
      new Set([1, 2]),
    );
  });

  it("no shop hours at all means every day is editable (lockout guard)", () => {
    expect(openWeekdaysFrom([])).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
  });

  it("multiple rows on one weekday collapse to one entry", () => {
    expect(openWeekdaysFrom([wh(1, "09:00:00", "11:00:00"), wh(1, "13:00:00", "17:00:00")])).toEqual(
      new Set([1]),
    );
  });
});

describe("bookingsOutsideHours", () => {
  // 2026-08-03 is a Monday. 02:30Z == 08:30 Thimphu (UTC+6).
  const now = new Date("2026-08-01T00:00:00.000Z");
  const week = withDay(
    emptyWeek(),
    day(1, [
      segment(510, 660), // 08:30–11:00
      segment(780, 930), // 13:00–15:30
    ]),
  );

  it("a booking inside a segment does not count", () => {
    expect(
      bookingsOutsideHours([bk("confirmed", new Date("2026-08-03T03:00:00Z"), 30)], week, now),
    ).toBe(0);
  });

  it("a booking inside the lunch gap counts", () => {
    // 06:00Z == 12:00 Thimphu, in the 11:00–13:00 gap.
    expect(
      bookingsOutsideHours([bk("confirmed", new Date("2026-08-03T06:00:00Z"), 30)], week, now),
    ).toBe(1);
  });

  it("a booking straddling the end of a segment counts", () => {
    // 10:45–11:15 local runs past the 11:00 boundary.
    expect(
      bookingsOutsideHours([bk("confirmed", new Date("2026-08-03T04:45:00Z"), 30)], week, now),
    ).toBe(1);
  });

  it("a booking on a now-unavailable day counts", () => {
    // 2026-08-04 is a Tuesday, which has no segments.
    expect(
      bookingsOutsideHours([bk("confirmed", new Date("2026-08-04T03:00:00Z"), 30)], week, now),
    ).toBe(1);
  });

  it("past bookings are ignored", () => {
    expect(
      bookingsOutsideHours([bk("confirmed", new Date("2026-07-27T06:00:00Z"), 30)], week, now),
    ).toBe(0);
  });

  it("cancelled, completed and no-show bookings are ignored", () => {
    const inGap = new Date("2026-08-03T06:00:00Z");
    expect(
      bookingsOutsideHours(
        [bk("cancelled", inGap, 30), bk("completed", inGap, 30), bk("no_show", inGap, 30)],
        week,
        now,
      ),
    ).toBe(0);
  });

  it("pending bookings count", () => {
    expect(
      bookingsOutsideHours([bk("pending", new Date("2026-08-03T06:00:00Z"), 30)], week, now),
    ).toBe(1);
  });
});

describe("enabledSegments", () => {
  it("sorts by start and drops the disabled, which every other reader relies on", () => {
    const d = day(1, [segment(780, 930), segment(510, 660), segment(600, 700, false)]);
    expect(enabledSegments(d).map((s) => s.startMin)).toEqual([510, 780]);
  });
});
