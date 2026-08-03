import { describe, expect, it } from "vitest";
import {
  bookedMinutesOnDay,
  countdownLabel,
  dayStats,
  groupWeekByDay,
  isActiveBooking,
  openMinutesForWeekday,
  perDayCounts,
} from "./calendar-logic";
import { thimphuDayBoundsUtc } from "./time";
import type { Booking, BookingStatus, WorkingHour } from "./types/booking";

/**
 * A direct port of `tho/app/test/calendar_logic_test.dart`.
 *
 * The cases and expected values are deliberately identical to the Dart suite: if
 * the two platforms ever disagree about which Thimphu day a booking falls on,
 * one of these files fails. Keep them in step when either side changes.
 */

function bk({
  start,
  durationMin = 60,
  status = "confirmed",
  price = 500,
}: {
  start: Date;
  durationMin?: number;
  status?: BookingStatus;
  price?: number;
}): Booking {
  return {
    id: `id-${start.getTime()}-${durationMin}-${status}-${price}`,
    status,
    startTs: start,
    endTs: new Date(start.getTime() + durationMin * 60_000),
    totalPrice: price,
  };
}

const wh = (dayOfWeek: number, startTime: string, endTime: string): WorkingHour => ({
  id: `wh-${dayOfWeek}-${startTime}`,
  dayOfWeek,
  startTime,
  endTime,
});

/** A Thimphu calendar day, the way the Dart tests pass `DateTime(y, m, d)`. */
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const utc = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min));

describe("thimphuDayBoundsUtc", () => {
  it("a Thimphu day is 18:00 UTC prev-day → 18:00 UTC same-day", () => {
    const b = thimphuDayBoundsUtc(day(2026, 7, 21));
    expect(b.from).toEqual(utc(2026, 7, 20, 18));
    expect(b.to).toEqual(utc(2026, 7, 21, 18));
  });

  it("only the y/m/d of the input matter (time-of-day ignored)", () => {
    const b = thimphuDayBoundsUtc(new Date(Date.UTC(2026, 6, 21, 23, 59, 59)));
    expect(b.from).toEqual(utc(2026, 7, 20, 18));
    expect(b.to).toEqual(utc(2026, 7, 21, 18));
  });
});

describe("isActiveBooking", () => {
  it("cancelled and no_show are inactive; the rest are active", () => {
    for (const s of ["pending", "confirmed", "completed"] as BookingStatus[]) {
      expect(isActiveBooking(bk({ start: utc(2026, 7, 21, 4), status: s }))).toBe(true);
    }
    for (const s of ["cancelled", "no_show"] as BookingStatus[]) {
      expect(isActiveBooking(bk({ start: utc(2026, 7, 21, 4), status: s }))).toBe(false);
    }
  });
});

describe("bookedMinutesOnDay", () => {
  it("sums end−start for active bookings only", () => {
    expect(
      bookedMinutesOnDay([
        bk({ start: utc(2026, 7, 21, 3), durationMin: 45 }),
        bk({ start: utc(2026, 7, 21, 5), durationMin: 30 }),
        bk({ start: utc(2026, 7, 21, 7), durationMin: 60, status: "cancelled" }),
      ]),
    ).toBe(75);
  });

  it("empty → 0", () => {
    expect(bookedMinutesOnDay([])).toBe(0);
  });
});

describe("countdownLabel", () => {
  const min = (n: number) => n * 60_000;

  it('now / negative → "now"', () => {
    expect(countdownLabel(0)).toBe("now");
    expect(countdownLabel(min(-5))).toBe("now");
  });

  it('sub-hour → "in N min"', () => {
    expect(countdownLabel(min(15))).toBe("in 15 min");
  });

  it('whole hours → "in N h"', () => {
    expect(countdownLabel(min(120))).toBe("in 2 h");
  });

  it('hours + minutes → "in N h M min"', () => {
    expect(countdownLabel(min(125))).toBe("in 2 h 5 min");
  });
});

describe("perDayCounts", () => {
  it("buckets active bookings into 7 Thimphu days from weekStart", () => {
    // Week starts Sun 2026-07-19. UTC 04:00 = Thimphu 10:00 (same day).
    const week = [
      bk({ start: utc(2026, 7, 19, 4) }), // day 0
      bk({ start: utc(2026, 7, 21, 4) }), // day 2
      bk({ start: utc(2026, 7, 21, 6) }), // day 2
      bk({ start: utc(2026, 7, 21, 6), status: "no_show" }), // excluded
      bk({ start: utc(2026, 8, 1, 4) }), // out of range
    ];
    expect(perDayCounts(week, day(2026, 7, 19))).toEqual([1, 0, 2, 0, 0, 0, 0]);
  });

  it("a late-evening Thimphu booking lands on the right day (not the UTC day)", () => {
    // UTC 2026-07-21 19:00 = Thimphu 2026-07-22 01:00 → day 3 of the week.
    expect(perDayCounts([bk({ start: utc(2026, 7, 21, 19) })], day(2026, 7, 19))).toEqual([
      0, 0, 0, 1, 0, 0, 0,
    ]);
  });
});

describe("groupWeekByDay", () => {
  it("an empty booking list still yields seven groups, each empty", () => {
    const groups = groupWeekByDay([], day(2026, 7, 19));
    expect(groups).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      expect(groups[i].day).toEqual(new Date(Date.UTC(2026, 6, 19 + i)));
      expect(groups[i].bookings).toEqual([]);
    }
  });

  it("a late-evening Thimphu booking lands on the right day (not the naive UTC day)", () => {
    // UTC 2026-08-02 19:00 = Thimphu 2026-08-03 01:00 → group 1, not group 0.
    const b = bk({ start: utc(2026, 8, 2, 19) });
    const groups = groupWeekByDay([b], day(2026, 8, 2));
    expect(groups[0].bookings).toEqual([]);
    expect(groups[1].day).toEqual(day(2026, 8, 3));
    expect(groups[1].bookings).toEqual([b]);
  });

  it("same-day bookings come back time-ordered, regardless of input order", () => {
    const early = bk({ start: utc(2026, 7, 21, 2) });
    const mid = bk({ start: utc(2026, 7, 21, 5) });
    const late = bk({ start: utc(2026, 7, 21, 9) });
    const groups = groupWeekByDay([late, early, mid], day(2026, 7, 19));
    expect(groups[2].bookings).toEqual([early, mid, late]);
  });

  it("a cancelled booking is dropped, same as perDayCounts", () => {
    const active = bk({ start: utc(2026, 7, 21, 4) });
    const cancelled = bk({ start: utc(2026, 7, 21, 6), status: "cancelled" });
    const groups = groupWeekByDay([active, cancelled], day(2026, 7, 19));
    expect(groups[2].bookings).toEqual([active]);
  });
});

describe("openMinutesForWeekday", () => {
  it("sums intervals for the matching weekday (0=Sun..6=Sat)", () => {
    const hours = [
      wh(1, "09:00:00", "17:00:00"),
      wh(1, "18:00:00", "20:00:00"),
      wh(2, "10:00:00", "14:00:00"),
    ];
    expect(openMinutesForWeekday(hours, 1)).toBe(600); // 8h + 2h
    expect(openMinutesForWeekday(hours, 2)).toBe(240);
  });

  it("no hours for that weekday → null (closed)", () => {
    expect(openMinutesForWeekday([wh(1, "09:00:00", "17:00:00")], 0)).toBeNull();
    expect(openMinutesForWeekday([], 3)).toBeNull();
  });
});

describe("dayStats", () => {
  const now = utc(2026, 7, 21, 6); // Thimphu 12:00

  it("counts, takings and next-up over active bookings", () => {
    const dayBookings = [
      bk({ start: utc(2026, 7, 21, 3), price: 400 }), // past
      bk({ start: utc(2026, 7, 21, 7), price: 500 }), // future → next-up
      bk({ start: utc(2026, 7, 21, 9), price: 600 }), // future, later
      bk({ start: utc(2026, 7, 21, 8), price: 999, status: "cancelled" }), // excluded
    ];
    const s = dayStats(dayBookings, now, 480);
    expect(s.appointmentCount).toBe(3);
    expect(s.expectedTakings).toBe(1500);
    expect(s.nextUp?.startTs).toEqual(utc(2026, 7, 21, 7));
    // booked minutes = 60*3 active = 180; util = 180/480 = 0.375
    expect(s.utilizationPct).toBeCloseTo(0.375, 9);
  });

  it("empty day → zeros, null next-up, null util (no openMinutes)", () => {
    const s = dayStats([], now);
    expect(s.appointmentCount).toBe(0);
    expect(s.expectedTakings).toBe(0);
    expect(s.nextUp).toBeNull();
    expect(s.utilizationPct).toBeNull();
  });

  it("all cancelled → count 0, takings 0, util 0 when openMinutes given", () => {
    const s = dayStats(
      [bk({ start: utc(2026, 7, 21, 7), status: "cancelled" })],
      now,
      480,
    );
    expect(s.appointmentCount).toBe(0);
    expect(s.expectedTakings).toBe(0);
    expect(s.nextUp).toBeNull();
    expect(s.utilizationPct).toBe(0);
  });

  it("next-up is null when every active booking is in the past", () => {
    expect(dayStats([bk({ start: utc(2026, 7, 21, 3) })], now).nextUp).toBeNull();
  });

  it("utilization clamps to 1.0 when over-booked", () => {
    expect(
      dayStats([bk({ start: utc(2026, 7, 21, 7), durationMin: 600 })], now, 120)
        .utilizationPct,
    ).toBe(1);
  });

  it("openMinutes of 0 → null util (no divide-by-zero)", () => {
    expect(
      dayStats([bk({ start: utc(2026, 7, 21, 7) })], now, 0).utilizationPct,
    ).toBeNull();
  });
});
