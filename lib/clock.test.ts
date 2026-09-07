import { describe, expect, it } from "vitest";
import {
  clockLabel,
  dateTimeLabel,
  dayTimeLabel,
  fullDayTimeLabel,
  hoursLabel,
  timeLabel,
} from "./clock";

/*
  Thimphu is UTC+6 with no DST, so every expectation below is exact arithmetic rather than an
  approximation — 08:00Z is 14:00 in Thimphu, always.
*/
const utc = (iso: string) => new Date(iso);

describe("timeLabel", () => {
  it("reads the salon's clock, not the reader's", () => {
    // 08:00 UTC is 2pm in Thimphu. A visitor in London must still see the salon's time.
    expect(timeLabel(utc("2026-09-02T08:00:00Z"))).toBe("2:00 PM");
    expect(timeLabel(utc("2026-09-02T03:05:00Z"))).toBe("9:05 AM");
  });

  /*
    Midnight and noon each get a case because `hour % 12` gets **both** wrong: it yields 0,
    which is not a clock hour, and the two need different markers. Upstream calls this out by
    name for the same reason.
  */
  it("gets midnight and noon right", () => {
    // 18:00Z the previous day is 00:00 Thimphu.
    expect(timeLabel(utc("2026-09-01T18:00:00Z"))).toBe("12:00 AM");
    // 06:00Z is 12:00 Thimphu.
    expect(timeLabel(utc("2026-09-02T06:00:00Z"))).toBe("12:00 PM");
  });

  it("pads the minute and never the hour", () => {
    expect(timeLabel(utc("2026-09-02T03:07:00Z"))).toBe("9:07 AM");
    expect(timeLabel(utc("2026-09-02T02:00:00Z"))).toBe("8:00 AM");
  });

  it("honours an explicit zone, for the notification worker's payload", () => {
    expect(timeLabel(utc("2026-09-02T08:00:00Z"), "UTC")).toBe("8:00 AM");
  });
});

describe("clockLabel", () => {
  it("converts the shape a Postgres time column arrives in", () => {
    expect(clockLabel("09:00")).toBe("9:00 AM");
    expect(clockLabel("18:00")).toBe("6:00 PM");
    expect(clockLabel("18:30:00")).toBe("6:30 PM");
    expect(clockLabel("00:00")).toBe("12:00 AM");
    expect(clockLabel("12:00")).toBe("12:00 PM");
  });

  /*
    Returns the input rather than a guess. A malformed row showing its raw value is a visible
    oddity somebody reports; the same row rendered as a plausible wrong time is not.
  */
  it("passes anything that is not a time straight through", () => {
    for (const raw of ["", "not a time", "9", "25:00", "09:99", "-1:00", "aa:bb"]) {
      expect(clockLabel(raw)).toBe(raw);
    }
  });
});

describe("the dated stamps", () => {
  const afternoon = utc("2026-09-02T08:00:00Z"); // Wed 2 Sep 2026, 2pm Thimphu

  it("reads as the app's stamps do, with no comma before the day", () => {
    expect(dayTimeLabel(afternoon)).toBe("Wed 2 Sep · 2:00 PM");
    expect(fullDayTimeLabel(afternoon)).toBe("Wednesday 2 Sep 2026 · 2:00 PM");
    expect(dateTimeLabel(afternoon)).toBe("2 Sep · 2:00 PM");
  });

  /*
    The case a naive implementation gets wrong: 19:00 UTC is already **tomorrow** in Thimphu,
    so the date half has to shift with the time half. Formatting the two independently — one
    in Thimphu and one in UTC — is how a booking ends up stamped with the wrong day.
  */
  it("carries the date across the Thimphu day boundary", () => {
    const lateUtc = utc("2026-09-02T19:00:00Z"); // 01:00 on 3 Sep in Thimphu
    expect(dayTimeLabel(lateUtc)).toBe("Thu 3 Sep · 1:00 AM");
    expect(fullDayTimeLabel(lateUtc)).toBe("Thursday 3 Sep 2026 · 1:00 AM");
  });
});

describe("hoursLabel", () => {
  it("joins two clock strings with an en dash", () => {
    expect(hoursLabel("09:00", "18:00")).toBe("9:00 AM – 6:00 PM");
    // An en dash, not a hyphen: it is a range, and the two are different characters.
    expect(hoursLabel("09:00", "18:00")).toContain("–");
    expect(hoursLabel("09:00", "18:00")).not.toContain(" - ");
  });
});
