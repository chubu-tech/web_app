import { describe, expect, it } from "vitest";
import { canFinalizeBooking, finalizeHintOrUnlocked, finalizeUnlocksHint } from "./booking-status-rules";

/*
  `now` is a parameter on all three, not a clock read, for the same reason it is on
  `clientInSegment`: the boundary is the whole behaviour, so it has to be assertable exactly.
  This repo has already been bitten by a calendar test that only failed after 22:00.
*/
const at = (iso: string) => new Date(iso);
const booking = (iso: string) => ({ startTs: at(iso) });

describe("canFinalizeBooking", () => {
  const b = booking("2026-09-07T14:00:00Z");

  it("refuses before the start — the P0017 the server now raises", () => {
    expect(canFinalizeBooking(b, at("2026-09-07T13:59:59Z"))).toBe(false);
    expect(canFinalizeBooking(b, at("2026-09-07T10:00:00Z"))).toBe(false);
  });

  it("allows from the start instant itself", () => {
    expect(canFinalizeBooking(b, at("2026-09-07T14:00:00Z"))).toBe(true);
  });

  it("allows while it is under way and after it should have ended", () => {
    expect(canFinalizeBooking(b, at("2026-09-07T14:10:00Z"))).toBe(true);
    // The boundary is start, not end: a 30-minute cut finished in 20 is ordinary.
    expect(canFinalizeBooking(b, at("2026-09-08T09:00:00Z"))).toBe(true);
  });

  /*
    The server allows from `start_ts - 5 minutes` and this does not, deliberately. A till
    tablet with a fast clock must never offer a button the server would refuse, so the client
    stays the stricter of the two — if this ever loosens to match, that property is gone.
  */
  it("is stricter than the server's five-minute slack", () => {
    expect(canFinalizeBooking(b, at("2026-09-07T13:56:00Z"))).toBe(false);
  });
});

describe("finalizeUnlocksHint", () => {
  const b = booking("2026-09-07T14:00:00Z");

  it("counts minutes under an hour, rounding up", () => {
    expect(finalizeUnlocksHint(b, at("2026-09-07T13:15:00Z"))).toBe("Complete in 45m");
    // 30 seconds out is still a minute away as far as the button is concerned.
    expect(finalizeUnlocksHint(b, at("2026-09-07T13:59:30Z"))).toBe("Complete in 1m");
  });

  it("counts hours under a day, rounding up", () => {
    expect(finalizeUnlocksHint(b, at("2026-09-07T11:00:00Z"))).toBe("Complete in 3h");
    expect(finalizeUnlocksHint(b, at("2026-09-07T12:30:00Z"))).toBe("Complete in 2h");
  });

  it("counts days beyond that", () => {
    expect(finalizeUnlocksHint(b, at("2026-09-05T14:00:00Z"))).toBe("Complete in 2d");
  });

  it("is null once the button is real, so the caller renders the button", () => {
    expect(finalizeUnlocksHint(b, at("2026-09-07T14:00:00Z"))).toBeNull();
    expect(finalizeUnlocksHint(b, at("2026-09-07T15:00:00Z"))).toBeNull();
  });
});

describe("finalizeHintOrUnlocked", () => {
  const b = booking("2026-09-07T14:00:00Z");

  it("says the buttons are there rather than counting to zero", () => {
    expect(finalizeHintOrUnlocked(b, at("2026-09-07T14:00:00Z"))).toBe("Complete unlocks now");
  });

  it("otherwise reads as the countdown", () => {
    expect(finalizeHintOrUnlocked(b, at("2026-09-07T13:30:00Z"))).toBe("Complete in 30m");
  });
});
