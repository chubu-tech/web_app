import { describe, expect, it } from "vitest";
import {
  bookingCode,
  bookingTab,
  hasNote,
  isActive,
  outstandingNu,
  servicesSummary,
  serviceIds,
  type Booking,
  type BookingStatus,
  type Payment,
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

const payment = (kind: string, amountNu: number): Payment => ({
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

describe("outstandingNu", () => {
  it("is the total when nothing has been paid", () => {
    expect(outstandingNu(500, [])).toBe(500);
  });

  it("subtracts payments and deposits", () => {
    expect(outstandingNu(500, [payment("deposit", 200)])).toBe(300);
    expect(outstandingNu(500, [payment("deposit", 200), payment("payment", 300)])).toBe(0);
  });

  it("adds a refund back to what is owed", () => {
    expect(outstandingNu(500, [payment("payment", 500), payment("refund", 200)])).toBe(200);
  });

  it("never goes negative — an overpayment is the salon's to settle", () => {
    expect(outstandingNu(500, [payment("payment", 800)])).toBe(0);
  });

  it("never exceeds the total, even with a refund larger than the price", () => {
    expect(outstandingNu(500, [payment("refund", 900)])).toBe(500);
  });

  it("rounds the total rather than showing chetrum", () => {
    expect(outstandingNu(349.5, [])).toBe(350);
  });
});
