import { describe, expect, it } from "vitest";
import {
  BOOKING_ERROR,
  asSentence,
  bookingErrorMessage,
  errorCode,
  isGuestRefusal,
  isSlotTaken,
} from "./booking-errors";

/**
 * The mapping from an `errcode` to a sentence, pinned against
 * `bookingFailureMessage` in `../tho/app/lib/customer/booking_guards.dart`.
 *
 * Written for the 2026-08-07 batch, which added four codes this table did not have — so the
 * four `default` cases below were, until now, all rendered as *"Couldn't cancel."* and its
 * siblings. Each of them is a refusal the customer can act on, and the point of mapping by
 * **code** rather than message text is that the sentence survives a reworded `raise`.
 */

/** What PostgREST hands back: a code, and a message written for a log. */
const pg = (code: string, message?: string) => ({ code, message });

describe("the codes are the codes the migrations raise", () => {
  it("has no duplicates, because two names for one code is a silent shadow", () => {
    const codes = Object.values(BOOKING_ERROR);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("carries the 2026-08-07 batch", () => {
    expect(BOOKING_ERROR.suspended).toBe("P0013");
    expect(BOOKING_ERROR.idempotencyMismatch).toBe("P0014");
    expect(BOOKING_ERROR.cancellationClosed).toBe("P0015");
    expect(BOOKING_ERROR.pastStart).toBe("P0016");
  });
});

describe("bookingErrorMessage — the cancellation window", () => {
  it("quotes the salon's own hour count", () => {
    /*
      `cancel_booking` raises with the number the salon itself configured — "free
      cancellation closed 12 hours before the appointment" — and that is more use than any
      generic line this file could write, because it is the rule the customer is subject to.
    */
    const text = bookingErrorMessage(
      pg("P0015", "free cancellation closed 12 hours before the appointment"),
      "Couldn't cancel.",
    );
    expect(text).toContain("12 hours");
    expect(text).toContain("Call the salon");
    expect(text).not.toContain("Couldn't cancel");
  });

  it("reads as a sentence, not as a log line", () => {
    expect(
      bookingErrorMessage(pg("P0015", "changes close 4 hours before the appointment"), "x"),
    ).toBe("Changes close 4 hours before the appointment. Call the salon if you need to change it.");
  });

  it("still says something useful with no message at all", () => {
    // A refusal with an empty message must not degrade into a bare full stop.
    const text = bookingErrorMessage(pg("P0015"), "Couldn't cancel.");
    expect(text).toContain("Call the salon");
    expect(text).not.toBe("Couldn't cancel.");
  });
});

describe("bookingErrorMessage — a start that has already passed", () => {
  it("says the same thing the client-side guard says", () => {
    // One sentence, two sources. `bookingErrorMessage` delegates to `bookingBlockMessage`
    // rather than repeating the words, so the pre-check and the refusal cannot drift apart.
    expect(bookingErrorMessage(pg("P0016", "that time has already passed"), "x")).toBe(
      "That time has already passed. Pick a later slot.",
    );
  });
});

describe("bookingErrorMessage — suspension and idempotency", () => {
  it("a suspended account is told what to do about it", () => {
    const text = bookingErrorMessage(pg("P0013", "account suspended"), "x");
    expect(text).toContain("suspended");
    expect(text).toContain("support");
  });

  it("a replayed key with changed details points at the booking that exists", () => {
    /*
      P0014 is the one refusal that is *also* a success: the booking went through, with the
      old details. Telling somebody "couldn't book" would send them to make a second one.
    */
    const text = bookingErrorMessage(pg("P0014", "idempotency key already used"), "x");
    expect(text).toContain("already went through");
    expect(text).toContain("bookings");
  });
});

describe("bookingErrorMessage — the reminders plan gate", () => {
  it("passes the salon's real reason through instead of blaming the network", () => {
    /*
      `set_booking_reminders` raises P0001 when enabling at a salon whose plan does not send
      reminders (`20260807000024_reminders_require_plan`). `canRemind` hides the switch on
      those salons, so this is the already-open tab and the query that forgot the embed — the
      revert path the toggle was built with, which until that migration had nothing to catch.
    */
    expect(
      bookingErrorMessage(
        pg("P0001", "this salon does not send appointment reminders"),
        "Couldn't save your reminder setting.",
      ),
    ).toBe("This salon does not send appointment reminders.");
  });

  it("falls back when a plan gate arrives with nothing to say", () => {
    expect(bookingErrorMessage(pg("P0001"), "Couldn't save.")).toBe("Couldn't save.");
  });
});

describe("the codes already mapped keep their sentences", () => {
  it.each([
    ["P0010", "Create an account"],
    ["P0011", "Cancel it first"],
    ["P0012", "Cancel it first"],
    ["23P01", "just been taken"],
    ["28000", "sign in"],
    ["42501", "isn't yours"],
    ["P0002", "no longer exists"],
  ])("%s explains itself", (code, fragment) => {
    expect(bookingErrorMessage(pg(code), "FALLBACK")).toContain(fragment);
  });

  it("an unmapped code, a bare Error and a string all reach the fallback", () => {
    expect(bookingErrorMessage(pg("42P01"), "FALLBACK")).toBe("FALLBACK");
    expect(bookingErrorMessage(new Error("network down"), "FALLBACK")).toBe("FALLBACK");
    expect(bookingErrorMessage("boom", "FALLBACK")).toBe("FALLBACK");
    expect(bookingErrorMessage(null, "FALLBACK")).toBe("FALLBACK");
  });
});

describe("the predicates", () => {
  it("read the code off whatever shape arrives", () => {
    expect(errorCode(pg("P0010"))).toBe("P0010");
    expect(errorCode("not an object")).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });

  it("distinguish a guest refusal and a taken slot from everything else", () => {
    expect(isGuestRefusal(pg("P0010"))).toBe(true);
    expect(isGuestRefusal(pg("P0016"))).toBe(false);
    expect(isSlotTaken(pg("23P01"))).toBe(true);
    expect(isSlotTaken(pg("P0015"))).toBe(false);
  });
});

describe("asSentence", () => {
  it("capitalises and terminates a server message", () => {
    expect(asSentence("that time has already passed")).toBe("That time has already passed.");
  });

  it("leaves an existing full stop alone rather than doubling it", () => {
    expect(asSentence("Already fine.")).toBe("Already fine.");
  });

  it("passes an empty message straight through", () => {
    expect(asSentence("")).toBe("");
  });
});
