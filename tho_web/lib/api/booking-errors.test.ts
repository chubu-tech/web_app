import { describe, expect, it } from "vitest";
import {
  BOOKING_ERROR,
  asSentence,
  bookingErrorMessage,
  isGuestRefusal,
  isSlotTaken,
} from "./booking-errors";

/**
 * The error map. Every branch here is something a customer reads at the moment a
 * booking fails, so a wrong mapping is a wrong explanation of their own money and time.
 *
 * Codes come from the `raise ... using errcode` calls in
 * `../tho/supabase/migrations/20260802000001_one_booking_per_day.sql` and
 * `20260801000004_guest_and_booking_guards.sql`.
 */

const pg = (code: string, message = "some server text") => ({ code, message });
const FALLBACK = "Couldn't do that.";

describe("bookingErrorMessage", () => {
  it("names the day rule without claiming it is salon-specific", () => {
    // THO-33 dropped the same-salon predicate, so the message must not say "here".
    const text = bookingErrorMessage(pg(BOOKING_ERROR.sameDay), FALLBACK);
    expect(text).toBe(
      "You already have a booking that day. Cancel it first, or pick another day.",
    );
    expect(text).not.toMatch(/this salon/i);
  });

  it("explains an overlap", () => {
    expect(bookingErrorMessage(pg(BOOKING_ERROR.overlaps), FALLBACK)).toMatch(
      /already have a booking at that time/,
    );
  });

  it("explains a lost slot as a race, not a fault", () => {
    expect(bookingErrorMessage(pg(BOOKING_ERROR.slotTaken), FALLBACK)).toMatch(
      /may have just been taken/,
    );
  });

  it("tells a guest what is missing", () => {
    expect(bookingErrorMessage(pg(BOOKING_ERROR.guestRefused), FALLBACK)).toMatch(
      /Create an account/,
    );
  });

  it("sends an unauthenticated caller to sign in", () => {
    expect(bookingErrorMessage(pg(BOOKING_ERROR.unauthenticated), FALLBACK)).toMatch(
      /sign in/i,
    );
  });

  it("passes a plan-gate message through, because it carries the real reason", () => {
    // "this shop is not running a queue" is more useful than any generic line we
    // could substitute — so it is capitalised and punctuated, not replaced.
    expect(
      bookingErrorMessage(pg(BOOKING_ERROR.notEntitled, "style selection is a Pro feature"), FALLBACK),
    ).toBe("Style selection is a Pro feature.");
  });

  it("falls back for a plan gate with no message", () => {
    expect(bookingErrorMessage({ code: BOOKING_ERROR.notEntitled }, FALLBACK)).toBe(FALLBACK);
  });

  it("falls back for an unknown code, a plain Error, and a string", () => {
    expect(bookingErrorMessage(pg("XX999"), FALLBACK)).toBe(FALLBACK);
    expect(bookingErrorMessage(new Error("network down"), FALLBACK)).toBe(FALLBACK);
    expect(bookingErrorMessage("boom", FALLBACK)).toBe(FALLBACK);
    expect(bookingErrorMessage(null, FALLBACK)).toBe(FALLBACK);
  });
});

describe("isGuestRefusal / isSlotTaken", () => {
  it("recognise their own codes and nothing else", () => {
    expect(isGuestRefusal(pg(BOOKING_ERROR.guestRefused))).toBe(true);
    expect(isGuestRefusal(pg(BOOKING_ERROR.slotTaken))).toBe(false);
    expect(isSlotTaken(pg(BOOKING_ERROR.slotTaken))).toBe(true);
    expect(isSlotTaken(pg(BOOKING_ERROR.sameDay))).toBe(false);
    expect(isGuestRefusal(new Error("nope"))).toBe(false);
  });
});

describe("asSentence", () => {
  it("capitalises and punctuates server text written for a log", () => {
    expect(asSentence("you already have a booking that day")).toBe(
      "You already have a booking that day.",
    );
  });

  it("leaves existing punctuation alone", () => {
    expect(asSentence("Already done.")).toBe("Already done.");
  });

  it("tolerates an empty message", () => {
    expect(asSentence("")).toBe("");
  });
});
