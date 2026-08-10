import { describe, expect, it } from "vitest";
import {
  blockForSlot,
  bookingBlockMessage,
  cancellationWindow,
  distanceKm,
  distanceLabel,
  isSlotReachable,
  travelWarning,
} from "./booking-guards";
import type { Booking, BookingStatus } from "./types/booking";

/**
 * A direct port of `tho/app/test/booking_guards_test.dart`.
 *
 * These pin the client-side reading of `create_booking`'s rules — in particular
 * that the day comparison happens in Bhutan time, not UTC, and that half-open
 * ranges make back-to-back bookings legal. Same cases, same expectations as the
 * Dart suite; if either drifts, one file fails.
 */

/** UTC times; the guard applies Bhutan's +06:00 itself. */
function bk({
  start,
  minutes = 30,
  status = "confirmed",
  businessId = "b1",
  businessName,
}: {
  start: Date;
  minutes?: number;
  status?: BookingStatus;
  businessId?: string;
  businessName?: string;
}): Booking {
  return {
    id: `bk-${start.getTime()}-${businessId}-${status}`,
    status,
    startTs: start,
    endTs: new Date(start.getTime() + minutes * 60_000),
    totalPrice: 300,
    businessId,
    businessName,
  };
}

const utc = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min));
const plusMin = (d: Date, n: number) => new Date(d.getTime() + n * 60_000);
const plusHours = (d: Date, n: number) => plusMin(d, n * 60);

/** Long before every slot in this file, so `pastStart` cannot fire in a clash case. */
const LONG_BEFORE = utc(2026, 1, 1);

/**
 * `blockForSlot` with the clock supplied.
 *
 * `now` is a required argument — the module reads no clock of its own — but it is not what
 * the clash cases are about, and repeating it fifteen times would bury the shape they port
 * from `booking_guards_test.dart`. The past-start group below calls `blockForSlot` directly,
 * so the real signature is still exercised.
 */
const blockFor = (args: Omit<Parameters<typeof blockForSlot>[0], "now">) =>
  blockForSlot({ ...args, now: LONG_BEFORE });

describe("blockForSlot — overlap", () => {
  const noon = utc(2026, 8, 14, 6); // 12:00 Bhutan

  it("no existing bookings means nothing blocks", () => {
    expect(
      blockFor({ existing: [], businessId: "b1", start: noon, durationMin: 30 }),
    ).toBeNull();
  });

  it("an overlapping booking at ANOTHER salon still blocks", () => {
    // You can't be in two chairs at once, whoever owns them.
    const block = blockFor({
      existing: [bk({ start: noon, businessId: "other" })],
      businessId: "b1",
      start: plusMin(noon, 15),
      durationMin: 30,
    });
    expect(block?.reason).toBe("overlapsExisting");
  });

  it("the block names the booking that caused it", () => {
    const existing = bk({
      start: noon,
      businessId: "other",
      businessName: "Lhaki Hair Studio",
    });
    const block = blockFor({
      existing: [existing],
      businessId: "b1",
      start: plusMin(noon, 15),
      durationMin: 30,
    });
    // The caller needs the CLASHING booking, not the one being attempted — the
    // only way the message can name the right salon.
    expect(block?.clash?.id).toBe(existing.id);
    expect(block?.clash?.businessName).toBe("Lhaki Hair Studio");
  });

  it("back-to-back is not an overlap", () => {
    // Existing 12:00–12:30, new 12:30–13:00 at a different salon. Half-open
    // ranges: touching is not overlapping. The day rule catches it instead — and
    // the overlap check runs FIRST, so getting the day reason here is precisely
    // what proves the range comparison is half-open.
    const block = blockFor({
      existing: [bk({ start: noon, minutes: 30, businessId: "other" })],
      businessId: "b1",
      start: plusMin(noon, 30),
      durationMin: 30,
    });
    expect(block?.reason).toBe("alreadyBookedThatDay");
  });

  it("back-to-back across local midnight blocks nothing at all", () => {
    // 23:45–00:15 Bhutan: the existing booking ends exactly when the new one
    // starts, and they fall on different local days — so neither rule fires.
    const lateNight = utc(2026, 8, 14, 17, 45); // 23:45 Bhutan
    expect(
      blockFor({
        existing: [bk({ start: lateNight, minutes: 15, businessId: "other" })],
        businessId: "b1",
        start: plusMin(lateNight, 15), // 00:00 Bhutan, 15th
        durationMin: 30,
      }),
    ).toBeNull();
  });

  it("a cancelled booking never blocks", () => {
    // Rebooking after a cancellation is precisely when people book again.
    expect(
      blockFor({
        existing: [bk({ start: noon, status: "cancelled" })],
        businessId: "b1",
        start: noon,
        durationMin: 30,
      }),
    ).toBeNull();
  });

  it("a completed booking never blocks", () => {
    expect(
      blockFor({
        existing: [bk({ start: noon, status: "completed" })],
        businessId: "b1",
        start: noon,
        durationMin: 30,
      }),
    ).toBeNull();
  });

  it("a pending booking blocks like a confirmed one", () => {
    const block = blockFor({
      existing: [bk({ start: noon, status: "pending", businessId: "other" })],
      businessId: "b1",
      start: noon,
      durationMin: 30,
    });
    expect(block?.reason).toBe("overlapsExisting");
  });
});

describe("blockForSlot — one booking per day, any salon", () => {
  it("a second slot at the same salon on the same day is blocked", () => {
    const morning = utc(2026, 8, 14, 3); // 09:00 Bhutan
    const afternoon = utc(2026, 8, 14, 9); // 15:00 Bhutan
    expect(
      blockFor({
        existing: [bk({ start: morning })],
        businessId: "b1",
        start: afternoon,
        durationMin: 30,
      })?.reason,
    ).toBe("alreadyBookedThatDay");
  });

  it("the same salon on a different day is fine", () => {
    expect(
      blockFor({
        existing: [bk({ start: utc(2026, 8, 14, 3) })],
        businessId: "b1",
        start: utc(2026, 8, 15, 3),
        durationMin: 30,
      }),
    ).toBeNull();
  });

  it("a DIFFERENT salon on the same day is blocked too", () => {
    // The widened rule: a live booking anywhere closes the day.
    const block = blockFor({
      existing: [
        bk({
          start: utc(2026, 8, 14, 3),
          businessId: "other",
          businessName: "Lhaki Hair Studio",
        }),
      ],
      businessId: "b1",
      start: utc(2026, 8, 14, 9),
      durationMin: 30,
    });
    expect(block?.reason).toBe("alreadyBookedThatDay");
    expect(block?.clash?.businessName).toBe("Lhaki Hair Studio");
  });

  it("a cancelled booking elsewhere frees the day again", () => {
    expect(
      blockFor({
        existing: [
          bk({ start: utc(2026, 8, 14, 3), businessId: "other", status: "cancelled" }),
        ],
        businessId: "b1",
        start: utc(2026, 8, 14, 9),
        durationMin: 30,
      }),
    ).toBeNull();
  });

  it("the day is judged in Bhutan time, not UTC", () => {
    // 20:00 Bhutan on the 14th is 14:00 UTC; 21:00 Bhutan is 15:00 UTC. Both are
    // the 14th locally, so the second must be blocked. Comparing in UTC would
    // agree here — so also check the case that crosses midnight UTC but not
    // local midnight: 05:30 UTC on the 15th is 11:30 Bhutan on the 15th, a
    // genuinely different day from 20:00 Bhutan on the 14th.
    const evening = utc(2026, 8, 14, 14);
    expect(
      blockFor({
        existing: [bk({ start: evening })],
        businessId: "b1",
        start: utc(2026, 8, 14, 15),
        durationMin: 30,
      })?.reason,
    ).toBe("alreadyBookedThatDay");

    expect(
      blockFor({
        existing: [bk({ start: evening })],
        businessId: "b1",
        start: utc(2026, 8, 15, 5, 30),
        durationMin: 30,
      }),
    ).toBeNull();
  });
});

/*
  The client's mirror of `20260807000035_reject_past_start`, whose pgTAP suite is
  `../tho/supabase/tests/past_start_test.sql`. There is no Dart equivalent — that migration
  was server-only — so these are the cases the SQL asserts about `create_booking`, expressed
  against the guard that has to agree with it.

  `compute_availability` filters against the same server clock, so the grid never offers a
  past slot; this is the slot that expired while somebody deliberated, and it is the difference
  between a sentence and a P0016.
*/
describe("blockForSlot — a start that has already passed", () => {
  const noon = utc(2026, 8, 14, 6); // 12:00 Bhutan

  it("refuses a slot in the past", () => {
    expect(
      blockForSlot({
        existing: [],
        businessId: "b1",
        start: noon,
        durationMin: 30,
        now: plusMin(noon, 1),
      })?.reason,
    ).toBe("pastStart");
  });

  it("carries no clashing booking, because nothing is in the way", () => {
    const block = blockForSlot({
      existing: [],
      start: noon,
      durationMin: 30,
      now: plusHours(noon, 3),
    });
    expect(block?.clash).toBeNull();
  });

  it("allows the slot that starts exactly now — no grace period either way", () => {
    /*
      `create_booking` compares `p_start_ts < now()`, so the boundary is open at the start:
      a slot beginning this instant is bookable, and the very next millisecond is not.
      Widening it would invent a slot the server refuses; narrowing it would refuse one the
      server takes.
    */
    expect(
      blockForSlot({ existing: [], start: noon, durationMin: 30, now: noon }),
    ).toBeNull();
    expect(
      blockForSlot({
        existing: [],
        start: noon,
        durationMin: 30,
        now: new Date(noon.getTime() + 1),
      })?.reason,
    ).toBe("pastStart");
  });

  it("a slot still to come is not blocked by the clock", () => {
    expect(
      blockForSlot({
        existing: [],
        start: noon,
        durationMin: 30,
        now: plusHours(noon, -2),
      }),
    ).toBeNull();
  });

  it("reports the passed time ahead of any clash, as the server does", () => {
    /*
      The RPC raises P0016 before it looks at working hours or `assert_customer_free`, and
      the ordering is the useful part: told "you already have a booking that day", somebody
      goes and cancels it, then finds the slot was never available. The check that names the
      real obstacle has to win.
    */
    const clash = bk({ start: noon, businessName: "Norzin Salon" });
    const block = blockForSlot({
      existing: [clash],
      businessId: "b1",
      start: plusMin(noon, 15),
      durationMin: 30,
      now: plusHours(noon, 1),
    });
    expect(block?.reason).toBe("pastStart");
    // Falsifiable: the same pair with the clock rolled back is an overlap.
    expect(
      blockForSlot({
        existing: [clash],
        businessId: "b1",
        start: plusMin(noon, 15),
        durationMin: 30,
        now: plusHours(noon, -1),
      })?.reason,
    ).toBe("overlapsExisting");
  });
});

describe("bookingBlockMessage", () => {
  it("names the salon the customer is already booked at", () => {
    expect(bookingBlockMessage("alreadyBookedThatDay", "Norzin Salon")).toContain(
      "Norzin Salon",
    );
  });

  it("falls back to a generic phrase without a name", () => {
    expect(bookingBlockMessage("alreadyBookedThatDay")).toContain("another salon");
  });

  it("the day-clash message says how to get unblocked", () => {
    // A dead end is worse than a rule: the sentence has to name the way out.
    expect(bookingBlockMessage("alreadyBookedThatDay")).toContain("Cancel it");
  });

  it("the overlap message suggests what to do next", () => {
    expect(bookingBlockMessage("overlapsExisting")).toContain("Cancel it first");
  });

  it("a passed slot says so and points forward, with no salon to name", () => {
    // Word for word what `bookingFailureMessage` gives P0016 upstream, so the pre-check and
    // the server's refusal cannot read as two different problems.
    expect(bookingBlockMessage("pastStart")).toBe("That time has already passed. Pick a later slot.");
    expect(bookingBlockMessage("pastStart", "Norzin Salon")).not.toContain("Norzin");
  });
});

/*
  A port of the window cases in `../tho/app/test/cancellation_window_test.dart`. That suite is
  a widget test — it asserts `onPressed == null` on two buttons — and the decision underneath
  it is what those buttons read, so it is the decision that is pinned here. The web renders it
  in two places (`/bookings/[id]` and its reschedule route), which is why the rule is one
  function rather than two copies of the arithmetic.
*/
describe("cancellationWindow", () => {
  const start = utc(2026, 8, 14, 6); // 12:00 Bhutan

  it("closes for a booking inside the window", () => {
    // Two hours out at a 12-hour salon: the cutoff passed ten hours ago.
    const state = cancellationWindow({
      startTs: start,
      windowHours: 12,
      now: plusHours(start, -2),
    });
    expect(state?.closed).toBe(true);
  });

  it("takes nothing away outside the window", () => {
    const state = cancellationWindow({
      startTs: start,
      windowHours: 12,
      now: plusHours(start, -72),
    });
    expect(state?.closed).toBe(false);
    expect(state?.freeUntil.toISOString()).toBe(plusHours(start, -12).toISOString());
  });

  it("a salon with no window keeps free cancellation to the last minute", () => {
    /*
      `coalesce(v_window, 0)` in the RPC, and 0 means the cutoff *is* the start time — the
      natural reading of "no notice required". So an hour before is still free, and the
      comparison has to be `now > freeUntil` rather than `>=`, or a booking starting this
      instant would be refused.
    */
    expect(
      cancellationWindow({ startTs: start, windowHours: 0, now: plusHours(start, -1) })?.closed,
    ).toBe(false);
    expect(cancellationWindow({ startTs: start, windowHours: 0, now: start })?.closed).toBe(
      false,
    );
    expect(
      cancellationWindow({ startTs: start, windowHours: 0, now: plusMin(start, 1) })?.closed,
    ).toBe(true);
  });

  it("the cutoff itself is still open; a minute past it is not", () => {
    const cutoff = plusHours(start, -12);
    expect(cancellationWindow({ startTs: start, windowHours: 12, now: cutoff })?.closed).toBe(
      false,
    );
    expect(
      cancellationWindow({ startTs: start, windowHours: 12, now: plusMin(cutoff, 1) })?.closed,
    ).toBe(true);
  });

  it("fails OPEN when the salon did not load, leaving the server the last word", () => {
    /*
      The case the Dart suite spells out: without the salon there is no window to apply.
      Disabling on a failed read would strand a customer who could legitimately cancel, and
      `cancel_booking` still raises P0015 if they could not. Null, not a guessed default —
      which is why the return type is nullable at all.
    */
    expect(
      cancellationWindow({ startTs: start, windowHours: null, now: plusHours(start, -1) }),
    ).toBeNull();
    expect(
      cancellationWindow({ startTs: start, windowHours: undefined, now: plusHours(start, -1) }),
    ).toBeNull();
  });

  it("a long window can close before the booking is even made", () => {
    // 48 hours at a salon somebody books for tomorrow: closed from the start, which is
    // correct and is the salon's own choice rather than a bug to clamp away.
    expect(
      cancellationWindow({ startTs: start, windowHours: 48, now: plusHours(start, -24) })?.closed,
    ).toBe(true);
  });
});

describe("distance", () => {
  const thimphu = { lat: 27.4712, lng: 89.6339 };

  it("is about zero at the salon itself", () => {
    expect(distanceKm({ lat: 27.4712, lng: 89.6339 }, thimphu)).toBeLessThan(0.05);
  });

  it("measures a real separation", () => {
    // Paro is roughly 20–25 km from Thimphu as the crow flies.
    const km = distanceKm({ lat: 27.4305, lng: 89.4133 }, thimphu);
    expect(km).toBeGreaterThanOrEqual(15);
    expect(km).toBeLessThanOrEqual(40);
  });

  it("labels sub-kilometre distances in metres", () => {
    expect(distanceLabel(0.34)).toBe("340 m away");
    expect(distanceLabel(1.25)).toBe("1.3 km away");
  });
});

describe("travel feasibility", () => {
  const now = utc(2026, 8, 14, 6);

  it("a slot far enough ahead is reachable", () => {
    // 25 km ≈ 60 min of travel; the slot is 3 hours out.
    expect(isSlotReachable({ km: 25, start: plusHours(now, 3), now })).toBe(true);
  });

  it("a slot sooner than the travel time is not", () => {
    expect(isSlotReachable({ km: 100, start: plusHours(now, 1), now })).toBe(false);
  });

  it("a slot already in the past is never reachable", () => {
    expect(isSlotReachable({ km: 1, start: plusMin(now, -5), now })).toBe(false);
  });

  it("the board example warns: 100 km away, booked for the next hour", () => {
    const warning = travelWarning({ km: 100, start: plusHours(now, 1), now });
    expect(warning).not.toBeNull();
    expect(warning).toContain("100.0 km away");
    expect(warning).toContain("4 hr");
  });

  it("a nearby salon never warns, however soon the slot", () => {
    expect(travelWarning({ km: 1.2, start: plusMin(now, 5), now })).toBeNull();
  });

  it("no distance means no warning rather than a guess", () => {
    expect(travelWarning({ km: null, start: plusMin(now, 5), now })).toBeNull();
  });

  it("a comfortable slot at a far salon does not warn", () => {
    expect(travelWarning({ km: 100, start: plusHours(now, 8), now })).toBeNull();
  });
});
