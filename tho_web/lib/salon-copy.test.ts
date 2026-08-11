import { describe, expect, it } from "vitest";
import { coverageLine, dayName, hhmm, todayHoursLine } from "./salon-copy";
import type { WorkingHour } from "./types/booking";

const hours = (dayOfWeek: number, startTime: string, endTime: string): WorkingHour => ({
  id: `${dayOfWeek}-${startTime}`,
  dayOfWeek,
  startTime,
  endTime,
});

/** 2026-07-22 is a Wednesday (dayOfWeek 3). 10:00 Thimphu === 04:00 UTC. */
const WED_10AM = new Date("2026-07-22T04:00:00.000Z");

describe("coverageLine", () => {
  it("names the radius when there is one", () => {
    expect(coverageLine({ serviceRadiusKm: 10 })).toBe("Travels up to 10 km to you");
  });

  it("drops the trailing zero on a whole number", () => {
    expect(coverageLine({ serviceRadiusKm: 5.0 })).toBe("Travels up to 5 km to you");
  });

  it("keeps one decimal on a fractional radius", () => {
    expect(coverageLine({ serviceRadiusKm: 7.5 })).toBe("Travels up to 7.5 km to you");
  });

  it("says 'Comes to you' when no radius is set", () => {
    expect(coverageLine({ serviceRadiusKm: null })).toBe("Comes to you");
  });
});

describe("todayHoursLine", () => {
  it("reads open when now is inside the window", () => {
    expect(todayHoursLine([hours(3, "09:00:00", "18:00:00")], WED_10AM)).toBe(
      "Open today · 09:00 – 18:00",
    );
  });

  it("reads 'opens later' before the window", () => {
    expect(todayHoursLine([hours(3, "14:00:00", "18:00:00")], WED_10AM)).toBe(
      "Opens 14:00 today",
    );
  });

  it("reads closed after the window", () => {
    expect(todayHoursLine([hours(3, "06:00:00", "09:00:00")], WED_10AM)).toBe(
      "Closed now · opened 06:00",
    );
  });

  it("reads 'Closed today' when the salon has no row for today", () => {
    expect(todayHoursLine([hours(4, "09:00:00", "18:00:00")], WED_10AM)).toBe(
      "Closed today",
    );
  });

  it("reads 'Closed today' when the salon has no hours at all", () => {
    // 1 of the 13 live salons is in exactly this state.
    expect(todayHoursLine([], WED_10AM)).toBe("Closed today");
  });

  it("shows only the segment covering now when a lunch break splits the day", () => {
    // Two rows, a gap between them. Spanning the gap would claim the salon is open
    // through lunch, which is the one thing this line must not do.
    const split = [hours(3, "09:00:00", "12:00:00"), hours(3, "13:00:00", "18:00:00")];
    expect(todayHoursLine(split, WED_10AM)).toBe("Open today · 09:00 – 12:00");
    // 12:30 Thimphu === 06:30 UTC — in the gap, so the afternoon segment is next.
    expect(todayHoursLine(split, new Date("2026-07-22T06:30:00.000Z"))).toBe(
      "Opens 13:00 today",
    );
  });

  it("is judged in Thimphu time, not the viewer's", () => {
    // 23:00 UTC Wednesday is 05:00 *Thursday* in Thimphu. A naive local-time port
    // would read Wednesday's row and, in a London browser, tell someone a shop is
    // open that shut hours ago.
    const lateUtc = new Date("2026-07-22T23:00:00.000Z");
    expect(todayHoursLine([hours(3, "09:00:00", "18:00:00")], lateUtc)).toBe(
      "Closed today",
    );
    expect(todayHoursLine([hours(4, "09:00:00", "18:00:00")], lateUtc)).toBe(
      "Opens 09:00 today",
    );
  });
});

describe("hhmm / dayName", () => {
  it("drops the seconds the database stores", () => {
    expect(hhmm("09:00:00")).toBe("09:00");
    expect(hhmm("18:30")).toBe("18:30");
  });

  it("names days from 0 = Sunday, matching business_hours.day_of_week", () => {
    expect(dayName(0)).toBe("Sunday");
    expect(dayName(6)).toBe("Saturday");
  });
});
