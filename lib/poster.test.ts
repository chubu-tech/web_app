import { describe, expect, it } from "vitest";
import { posterHoursLine, posterTagline } from "./poster";
import type { WorkingHour } from "./types/booking";

/**
 * No Dart original: the Flutter app prints no poster, so there is nothing upstream to keep
 * in step with. The cases that matter are the ones where a poster could state something
 * false, because that is the failure this line can cause — somebody driving to a shut shop.
 */
let seq = 0;
const hour = (dayOfWeek: number, startTime: string, endTime: string): WorkingHour => ({
  id: `h${seq++}`,
  dayOfWeek,
  startTime,
  endTime,
});

/** 0 = Sunday, matching `business_hours.day_of_week`. */
const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0;

describe("posterHoursLine", () => {
  it("renders the design's own example", () => {
    const week = [MON, TUE, WED, THU, FRI, SAT].map((d) =>
      hour(d, "09:00:00", "19:00:00"),
    );
    // Twelve-hour, matching the app's own `formatMinutes12` — see `short()`.
    expect(posterHoursLine(week)).toBe("Mon–Sat, 9:00 am – 7:00 pm");
  });

  it("covers a full seven-day week", () => {
    const week = WEEK.map((d) => hour(d, "08:00:00", "20:00:00"));
    expect(posterHoursLine(week)).toBe("Mon–Sun, 8:00 am – 8:00 pm");
  });

  it("names a single day rather than inventing a range", () => {
    expect(posterHoursLine([hour(WED, "09:00:00", "17:00:00")])).toBe("Wed, 9:00 am – 5:00 pm");
  });

  it("takes the longest agreeing run, not the whole week", () => {
    // Saturday differs. Spanning Mon–Sat would advertise a 19:00 close on a day that
    // shuts at 16:00 — the false line this function exists to avoid.
    const week = [
      ...[MON, TUE, WED, THU, FRI].map((d) => hour(d, "09:00:00", "19:00:00")),
      hour(SAT, "10:00:00", "16:00:00"),
    ];
    expect(posterHoursLine(week)).toBe("Mon–Fri, 9:00 am – 7:00 pm");
  });

  it("absorbs a lunch break into the day's outer span", () => {
    // Two rows for one day is how a break is stored. A poster says when the shop is
    // open-ish; `todayHoursLine` is the surface that must not span the gap.
    const week = [MON, TUE, WED].flatMap((d) => [
      hour(d, "09:00:00", "12:00:00"),
      hour(d, "13:00:00", "18:00:00"),
    ]);
    expect(posterHoursLine(week)).toBe("Mon–Wed, 9:00 am – 6:00 pm");
  });

  it("does not run a group across a closed day", () => {
    // Mon-Tue and Thu-Fri share hours but Wednesday is shut, so they are two runs of two,
    // and the earlier one wins the tie.
    const week = [MON, TUE, THU, FRI].map((d) => hour(d, "09:00:00", "18:00:00"));
    expect(posterHoursLine(week)).toBe("Mon–Tue, 9:00 am – 6:00 pm");
  });

  it("treats the week as Monday-first, so Sunday can close a run", () => {
    const week = [SAT, SUN].map((d) => hour(d, "10:00:00", "14:00:00"));
    expect(posterHoursLine(week)).toBe("Sat–Sun, 10:00 am – 2:00 pm");
  });

  it("does not wrap Sunday round to Monday", () => {
    // Sun and Mon are adjacent on a calendar but not in this ordering, and joining them
    // would print "Sun–Mon", which reads as a six-day range.
    const week = [SUN, MON].map((d) => hour(d, "11:00:00", "15:00:00"));
    expect(posterHoursLine(week)).toBe("Mon, 11:00 am – 3:00 pm");
  });

  it("keeps the earliest run when two are the same length", () => {
    const week = [
      ...[MON, TUE].map((d) => hour(d, "09:00:00", "17:00:00")),
      ...[THU, FRI].map((d) => hour(d, "10:00:00", "18:00:00")),
    ];
    expect(posterHoursLine(week)).toBe("Mon–Tue, 9:00 am – 5:00 pm");
  });

  it("returns null when the salon has no hours", () => {
    // The caller drops the whole "Open" column rather than printing an empty label.
    expect(posterHoursLine([])).toBeNull();
  });

  it("handles a day that closes at midnight", () => {
    // `24:00:00` is a valid Postgres time and the hours editor can write it. It is
    // midnight, and `h24 % 12 -> 12` with an `am` meridiem is what the Dart returns too.
    expect(posterHoursLine([hour(FRI, "18:00:00", "24:00:00")])).toBe("Fri, 6:00 pm – 12:00 am");
  });
});

const WEEK = [MON, TUE, WED, THU, FRI, SAT, SUN];

describe("posterTagline", () => {
  it("keeps the design's placeholder for a salon", () => {
    expect(posterTagline("salon")).toBe("Hair · Beauty · Care");
  });

  it("says something true for the other three shop types", () => {
    // A mobile stylist has no premises, so the salon line would promise a door that a
    // customer reading the poster cannot walk through.
    expect(posterTagline("barber")).toBe("Cuts · Shaves · Grooming");
    expect(posterTagline("home_based")).toBe("Hair · Beauty · By appointment");
    expect(posterTagline("mobile")).toBe("Hair · Beauty · We come to you");
  });
});
