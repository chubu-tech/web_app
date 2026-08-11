import { describe, expect, it } from "vitest";
import {
  bookingCode,
  bookingTab,
  canRemind,
  hasNote,
  isActive,
  depositNu,
  outstandingNu,
  relativeDayLabel,
  servicesSummary,
  serviceIds,
  type Booking,
  type BookingStatus,
  type Payment,
  type PaymentKind,
} from "./booking";

/**
 * The derived reads on a booking, ported from the getters on `Booking` in
 * `tho/app/lib/data/models.dart`. Each one puts text or money in front of a customer,
 * so each one gets cases.
 */

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  status: "confirmed",
  startTs: new Date("2026-08-10T04:00:00.000Z"),
  endTs: new Date("2026-08-10T05:00:00.000Z"),
  totalPrice: 0,
  ...over,
});

const item = (name: string, durationMinutes: number, price = 0, serviceId?: string) => ({
  id: `${name}-${durationMinutes}`,
  serviceId: serviceId ?? null,
  name,
  price,
  durationMinutes,
});

/**
 * These used to pass `"payment"` as a kind, which `payments_kind_check` **forbids** — the four
 * it allows are `deposit`, `balance`, `full` and `refund`. Nothing caught it because the kind
 * only matters to `outstandingNu` when it is `refund`, and because `payments` has 0 rows. Now
 * the union is the constraint, so a value the database would reject cannot be asserted against.
 */
const payment = (kind: PaymentKind, amountNu: number): Payment => ({
  id: `${kind}-${amountNu}`,
  amountNu,
  kind,
  method: "cash",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
});

describe("bookingCode", () => {
  it("is the first eight hex digits, upper case, with a hash", () => {
    expect(bookingCode({ id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" })).toBe("#A1B2C3D4");
  });

  it("skips the dashes rather than counting them", () => {
    // "ab-cdef-gh..." must not become "#AB-CDEF" — the code is shown to staff and
    // read aloud, so a stray dash costs a whole character of signal.
    expect(bookingCode({ id: "ab-cdef-1234-5678-90abcdef1234" })).toBe("#ABCDEF12");
  });
});

describe("serviceIds", () => {
  it("collects the booked service ids", () => {
    const b = booking({ items: [item("Cut", 30, 300, "s1"), item("Beard", 20, 150, "s2")] });
    expect(serviceIds(b)).toEqual(["s1", "s2"]);
  });

  it("drops items with no service id — a free-text walk-in line has none", () => {
    const b = booking({ items: [item("Cut", 30, 300, "s1"), item("Something else", 15)] });
    expect(serviceIds(b)).toEqual(["s1"]);
  });

  it("is empty when there are no items, so reschedule can refuse rather than offer nothing", () => {
    expect(serviceIds(booking())).toEqual([]);
  });
});

describe("servicesSummary", () => {
  it("joins names and totals the duration", () => {
    const b = booking({ items: [item("Haircut", 30), item("Beard trim", 15)] });
    expect(servicesSummary(b)).toBe("Haircut + Beard trim · 45 min");
  });

  it("omits the duration when it totals zero", () => {
    expect(servicesSummary(booking({ items: [item("Consultation", 0)] }))).toBe(
      "Consultation",
    );
  });

  it("falls back to 'Appointment' with no items", () => {
    expect(servicesSummary(booking())).toBe("Appointment");
  });
});

describe("hasNote", () => {
  it("ignores whitespace — a note of spaces is not a note", () => {
    expect(hasNote({ customerNote: "   " })).toBe(false);
    expect(hasNote({ customerNote: null })).toBe(false);
    expect(hasNote({ customerNote: "keep the sides short" })).toBe(true);
  });
});

describe("isActive / bookingTab", () => {
  const cases: [BookingStatus, boolean, 0 | 1 | 2][] = [
    ["pending", true, 0],
    ["confirmed", true, 0],
    ["completed", false, 1],
    ["cancelled", false, 2],
    ["no_show", false, 2],
  ];

  it.each(cases)("%s → active %s, tab %i", (status, active, tab) => {
    expect(isActive({ status })).toBe(active);
    expect(bookingTab({ status })).toBe(tab);
  });

  it("buckets by status, not by date", () => {
    // A confirmed booking whose time has passed but which nobody completed still reads
    // as Upcoming — as far as the salon's records go it is live, and that is the honest
    // answer (`customer_home.dart:843`).
    expect(bookingTab({ status: "confirmed" })).toBe(0);
  });
});

/*
  `20260807000024_reminders_require_plan`, client half. The switch appeared on every card
  while `private.enqueue_booking_reminders` returned early below growth — measured upstream as
  the same booking enqueueing 0 reminders on basic and 2 on growth, with no error either way,
  so a customer switched reminders on and was never reminded. Mirrors the cases in
  `../tho/app/test/booking_reminders_test.dart`.
*/
describe("canRemind", () => {
  const remindable = (over: Partial<Booking> = {}) =>
    booking({ status: "confirmed", customerProfileId: "cust-1", businessPlan: "growth", ...over });

  it.each([
    ["growth", true],
    ["pro", true],
    ["basic", false],
  ] as const)("%s → %s", (plan, expected) => {
    expect(canRemind(remindable({ businessPlan: plan }))).toBe(expected);
  });

  it("an unknown plan string is treated as Basic, like every other gate", () => {
    expect(canRemind(remindable({ businessPlan: "platinum" }))).toBe(false);
  });

  it("a null plan OFFERS the switch, because null is not Basic", () => {
    /*
      The one case that is easy to get backwards, and the reason this is not a bare
      `hasFeature` call: `planFromString` maps null to `basic`, so reading the plan directly
      would hide a working control whenever the query failed to embed one. Null means "not
      asked", and since the migration the server refuses with P0001 if that guess was wrong —
      which is what `ReminderToggle`'s revert path is for.
    */
    expect(canRemind(remindable({ businessPlan: null }))).toBe(true);
    expect(canRemind(remindable({ businessPlan: undefined }))).toBe(true);
  });

  it("is absent on a walk-in, which has nobody to remind", () => {
    // `set_booking_reminders` raises 42501 on a null `customer_profile_id`. Absent rather
    // than present and doomed.
    expect(canRemind(remindable({ customerProfileId: null }))).toBe(false);
    expect(canRemind(remindable({ customerProfileId: undefined }))).toBe(false);
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "is absent on a %s booking",
    (status) => {
      expect(canRemind(remindable({ status }))).toBe(false);
    },
  );

  it("is offered on a pending booking, not only a confirmed one", () => {
    expect(canRemind(remindable({ status: "pending" }))).toBe(true);
  });
});

/*
  `outstandingNu` — and the convention it used to get backwards.

  **`record_payment` stores a refund as a NEGATIVE `amount_nu`.** These tests used to pass a
  refund as a positive magnitude and expect it to be negated, which matched the implementation
  and matched nothing the database can hold. `payments` had 0 rows on every platform, so neither
  the code nor the tests were ever confronted with a real row — the bug surfaced within minutes
  of a writer existing: a Nu 1,200 booking with a Nu 400 deposit and a Nu 150 refund rendered
  **Outstanding Nu 650** where the truth is 950.

  The factory now takes the amount as the column stores it, so a wrong sign is a failing test.
*/
describe("outstandingNu", () => {
  it("is the total when nothing has been paid", () => {
    expect(outstandingNu(500, [])).toBe(500);
  });

  it("subtracts a deposit and a balance", () => {
    expect(outstandingNu(500, [payment("deposit", 200)])).toBe(300);
    expect(outstandingNu(500, [payment("deposit", 200), payment("balance", 300)])).toBe(0);
  });

  it("adds a refund back to what is owed — stored negative", () => {
    expect(outstandingNu(500, [payment("balance", 500), payment("refund", -200)])).toBe(200);
  });

  it("gets the live case right", () => {
    // The exact numbers the browser run produced, which is what caught this.
    expect(
      outstandingNu(1200, [payment("deposit", 400), payment("refund", -150)]),
    ).toBe(950);
  });

  it("a deposit fully refunded leaves the whole total owed", () => {
    expect(outstandingNu(500, [payment("deposit", 500), payment("refund", -500)])).toBe(500);
  });

  it("never goes negative — an overpayment is the salon's to settle", () => {
    expect(outstandingNu(500, [payment("balance", 800)])).toBe(0);
  });

  it("never exceeds the total, even with a refund larger than the price", () => {
    expect(outstandingNu(500, [payment("refund", -900)])).toBe(500);
  });

  it("rounds the total rather than showing chetrum", () => {
    expect(outstandingNu(499.6, [])).toBe(500);
  });
});

/*
  `depositNu` — what the salon keeps if nobody turns up.

  Deposits only, net of refunds. The distinction from "everything paid" is the point: a balance
  handed over after the cut is not no-show cover, and the pill this feeds names an entitlement
  (`deposits`) that is specifically about money taken up front.
*/
describe("depositNu", () => {
  it("sums the deposits", () => {
    expect(depositNu([payment("deposit", 200), payment("deposit", 300)])).toBe(500);
  });

  it("ignores a balance and a full payment", () => {
    // The case that separates this from `outstandingNu`. Nu 1,000 has been paid; none of it is
    // cover.
    expect(depositNu([payment("balance", 600), payment("full", 400)])).toBe(0);
  });

  it("nets a refund off, so a returned deposit is not still cover", () => {
    // Negative, as `record_payment` writes it.
    expect(depositNu([payment("deposit", 500), payment("refund", -200)])).toBe(300);
    expect(depositNu([payment("deposit", 500), payment("refund", -500)])).toBe(0);
  });

  it("is insensitive to the refund's sign, unlike outstandingNu", () => {
    // This one subtracts explicitly rather than summing, so `Math.abs` is what stops the two
    // cancelling out. Pinned because the asymmetry between the two functions is deliberate and
    // looks like an inconsistency.
    expect(depositNu([payment("deposit", 500), payment("refund", 200)])).toBe(300);
  });

  it("clamps at zero rather than reporting negative cover", () => {
    expect(depositNu([payment("deposit", 100), payment("refund", -400)])).toBe(0);
  });

  it("is zero with no payments at all", () => {
    expect(depositNu([])).toBe(0);
  });
});

/*
  `relativeDayLabel` — moved out of `booking-card.tsx`, where it read `new Date()` inside the
  render. Both surfaces that show it now take the same `now`, which is what these pin: the
  boundaries are **Thimphu** calendar days, so a UTC evening is already tomorrow in Bhutan.
*/
describe("relativeDayLabel", () => {
  // 2026-08-10T04:00Z is 10:00 on the 10th in Thimphu.
  const now = new Date("2026-08-10T04:00:00.000Z");

  it("names today, tomorrow and the week", () => {
    expect(relativeDayLabel(new Date("2026-08-10T09:00:00.000Z"), now)).toBe("Today");
    expect(relativeDayLabel(new Date("2026-08-11T03:00:00.000Z"), now)).toBe("Tomorrow");
    expect(relativeDayLabel(new Date("2026-08-13T03:00:00.000Z"), now)).toBe("In 3 days");
    expect(relativeDayLabel(new Date("2026-08-17T03:00:00.000Z"), now)).toBe("In 7 days");
  });

  it("is null beyond a week — a chip reading 'In 23 days' is not a chip", () => {
    expect(relativeDayLabel(new Date("2026-08-18T03:00:00.000Z"), now)).toBeNull();
  });

  it("is null for anything already past", () => {
    expect(relativeDayLabel(new Date("2026-08-09T03:00:00.000Z"), now)).toBeNull();
  });

  it("crosses the day boundary in THIMPHU, not UTC", () => {
    /*
      The case the whole helper exists for. 19:00Z on the 10th is 01:00 on the **11th** in
      Thimphu, so an appointment then is "Tomorrow" — while a UTC reading would still call the
      10th today and say "Today" for an appointment that has moved to the next day.
    */
    expect(relativeDayLabel(new Date("2026-08-10T19:00:00.000Z"), now)).toBe("Tomorrow");
  });

  it("is Today for an appointment later on the same Thimphu day, read from a UTC evening", () => {
    // now = 23:00Z on the 9th, which is 05:00 on the 10th in Thimphu. An 08:00Z appointment on
    // the 10th (14:00 Thimphu) is the same Thimphu day.
    const lateUtc = new Date("2026-08-09T23:00:00.000Z");
    expect(relativeDayLabel(new Date("2026-08-10T08:00:00.000Z"), lateUtc)).toBe("Today");
  });
});
