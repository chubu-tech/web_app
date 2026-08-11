import { describe, expect, it } from "vitest";
import { availableLabel, availableToday } from "./available-today";
import type { QueueEntry } from "./types/queue";
import type { Business, SalonAvailability } from "./types/salon";

/**
 * A port of the `AvailableTodayRow` cases in
 * `../tho/app/lib/customer/home_sections.dart:747-829`.
 *
 * The three rules the Dart's comments single out are each pinned by a test that fails if the
 * rule is dropped: a row with no answer is excluded, a slot and a walk-in wait are ranked on
 * one scale, and an unknown distance sorts last within its tie bucket rather than as zero.
 */

const THIMPHU = { lat: 27.4712, lng: 89.6339 };

function biz(id: string, over: Partial<Business> = {}): Business {
  return {
    id,
    name: `Salon ${id}`,
    description: null,
    addressText: null,
    phone: null,
    coverUrl: null,
    timezone: "Asia/Thimphu",
    cancellationWindowHours: 12,
    isActive: true,
    lat: null,
    lng: null,
    avgRating: null,
    reviewCount: 0,
    plan: "basic",
    businessType: "salon",
    serviceRadiusKm: null,
    whatsappPhone: null,
    queueEnabled: true,
    queueJoinMode: "anywhere",
    reminderChannel: "push",
    monthlyRevenueGoal: null,
    rebookingEnabled: false,
    rebookingDays: 30,
    ...over,
  };
}

/**
 * One waiting head, so `queueShopSummary` has a real line to estimate from.
 *
 * The PII fields are null because `salons_available_today` does not return them — its
 * `queue_line` is `queue_active_line`'s projection exactly, which carries no name, phone or
 * avatar and not even a `business_id`.
 */
function waiting(id: string, minutes = 20): QueueEntry {
  return {
    id,
    businessId: "b",
    businessName: null,
    staffMemberId: null,
    serviceId: null,
    customerProfileId: null,
    customerName: null,
    customerPhone: null,
    customerAvatarUrl: null,
    bookingId: null,
    status: "waiting",
    priorityAt: null,
    joinedAt: new Date("2026-08-10T04:00:00.000Z"),
    serviceMinutes: minutes,
    servingRemainingMinutes: 0,
  };
}

function avail(businessId: string, over: Partial<SalonAvailability> = {}): SalonAvailability {
  return {
    businessId,
    nextSlot: null,
    openCount: 1,
    queueLine: [],
    barberCount: 1,
    ...over,
  };
}

const NOW = new Date("2026-08-10T06:00:00.000Z"); // 12:00 Thimphu

describe("availableToday — what gets in", () => {
  it("keeps a salon with a slot", () => {
    const rows = availableToday(
      [biz("a")],
      [avail("a", { nextSlot: new Date("2026-08-10T08:00:00.000Z") })],
      { now: NOW },
    );
    expect(rows.map((r) => r.business.id)).toEqual(["a"]);
  });

  it("keeps a salon with only a live line", () => {
    const rows = availableToday([biz("a")], [avail("a", { queueLine: [waiting("q1")] })], {
      now: NOW,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.slot).toBeNull();
    expect(rows[0]!.waitMinutes).not.toBeNull();
  });

  it("drops a salon offering neither — the row must not become the flat list again", () => {
    expect(availableToday([biz("a")], [avail("a")], { now: NOW })).toEqual([]);
  });

  it("drops an availability row with no matching salon", () => {
    /*
      The RPC's moderation gate and the caller's list are resolved independently, so an id
      can be in one and not the other — a salon the caller filtered out by rating, or one
      the RPC returned and the page never loaded.
    */
    const rows = availableToday(
      [biz("a")],
      [
        avail("a", { nextSlot: new Date("2026-08-10T08:00:00.000Z") }),
        avail("ghost", { nextSlot: new Date("2026-08-10T07:00:00.000Z") }),
      ],
      { now: NOW },
    );
    expect(rows.map((r) => r.business.id)).toEqual(["a"]);
  });

  it("an empty line is no walk-in answer, not a zero wait", () => {
    // The RPC returns `[]` for any salon below Growth or with the line switched off — the
    // opposite of `fetchActiveLine`, where `[]` means the line is genuinely empty.
    const rows = availableToday([biz("a")], [avail("a", { queueLine: [] })], { now: NOW });
    expect(rows).toEqual([]);
  });

  it("caps the row", () => {
    const businesses = Array.from({ length: 12 }, (_, i) => biz(`b${i}`));
    const availability = businesses.map((b, i) =>
      avail(b.id, { nextSlot: new Date(NOW.getTime() + (i + 1) * 600_000) }),
    );
    expect(availableToday(businesses, availability, { now: NOW })).toHaveLength(8);
    expect(availableToday(businesses, availability, { now: NOW, limit: 3 })).toHaveLength(3);
  });
});

describe("availableToday — the order", () => {
  it("is soonest first", () => {
    const rows = availableToday(
      [biz("late"), biz("soon"), biz("mid")],
      [
        avail("late", { nextSlot: new Date("2026-08-10T10:00:00.000Z") }),
        avail("soon", { nextSlot: new Date("2026-08-10T06:30:00.000Z") }),
        avail("mid", { nextSlot: new Date("2026-08-10T08:00:00.000Z") }),
      ],
      { now: NOW },
    );
    expect(rows.map((r) => r.business.id)).toEqual(["soon", "mid", "late"]);
  });

  it("ranks a walk-in wait against a booked slot on one scale", () => {
    /*
      The decision this pins: a shop that can seat you in ~20 minutes comes **before** one
      whose next slot is two hours away. Both cards state their own answer, so the order is
      accountable; ranking the two on separate scales would look arbitrary on screen.
    */
    const rows = availableToday(
      [biz("booked"), biz("walkin")],
      [
        avail("booked", { nextSlot: new Date("2026-08-10T08:00:00.000Z") }),
        avail("walkin", { queueLine: [waiting("q1")] }),
      ],
      { now: NOW },
    );
    expect(rows.map((r) => r.business.id)).toEqual(["walkin", "booked"]);
  });

  it("breaks a tie by distance", () => {
    const slot = new Date("2026-08-10T08:00:00.000Z");
    const rows = availableToday(
      [
        biz("far", { lat: 27.4305, lng: 89.4164 }),
        biz("near", { lat: 27.4741, lng: 89.6377 }),
      ],
      [avail("far", { nextSlot: slot }), avail("near", { nextSlot: slot })],
      { now: NOW, from: THIMPHU },
    );
    expect(rows.map((r) => r.business.id)).toEqual(["near", "far"]);
  });

  it("sorts an unknown distance LAST within its tie bucket, never as zero", () => {
    /*
      The case that separates a correct comparator from a plausible one. A salon with no
      coordinates is not nearby; `km ?? 0` would float every unlocated salon above every
      located one on every tie — and 12 of the 14 approved salons have coordinates, so the
      two without would lead the row.
    */
    const slot = new Date("2026-08-10T08:00:00.000Z");
    const rows = availableToday(
      [biz("nowhere"), biz("near", { lat: 27.4741, lng: 89.6377 })],
      [avail("nowhere", { nextSlot: slot }), avail("near", { nextSlot: slot })],
      { now: NOW, from: THIMPHU },
    );
    expect(rows.map((r) => r.business.id)).toEqual(["near", "nowhere"]);
  });

  it("leaves the order alone when there is no fix to measure from", () => {
    const slot = new Date("2026-08-10T08:00:00.000Z");
    const rows = availableToday(
      [biz("a", { lat: 27.43, lng: 89.41 }), biz("b", { lat: 27.47, lng: 89.63 })],
      [avail("a", { nextSlot: slot }), avail("b", { nextSlot: slot })],
      { now: NOW },
    );
    expect(rows.map((r) => r.business.id)).toEqual(["a", "b"]);
    expect(rows.every((r) => r.km === null)).toBe(true);
  });

  it("a slot already past sorts ahead of everything, because it is still today", () => {
    // `compute_availability` filters against the server clock, so this is the stale-tab
    // case rather than a normal one — but the comparator must stay total.
    const rows = availableToday(
      [biz("stale"), biz("soon")],
      [
        avail("stale", { nextSlot: new Date("2026-08-10T05:00:00.000Z") }),
        avail("soon", { nextSlot: new Date("2026-08-10T06:30:00.000Z") }),
      ],
      { now: NOW },
    );
    expect(rows.map((r) => r.business.id)).toEqual(["stale", "soon"]);
  });
});

describe("availableLabel", () => {
  it("reads a slot in Thimphu time, not the viewer's", () => {
    // 08:00Z is 14:00 in Thimphu (UTC+6). A browser in London must see the hour the
    // customer will actually turn up at.
    expect(availableLabel({ slot: new Date("2026-08-10T08:00:00.000Z"), waitMinutes: null })).toBe(
      "Today 14:00",
    );
  });

  it("pads both fields", () => {
    expect(availableLabel({ slot: new Date("2026-08-10T03:05:00.000Z"), waitMinutes: null })).toBe(
      "Today 09:05",
    );
  });

  it("crosses midnight UTC without changing the Thimphu hour", () => {
    // 19:30Z is 01:30 the next Thimphu day. The label states a clock time, not a date, so
    // this is about the arithmetic being an offset rather than a date read.
    expect(availableLabel({ slot: new Date("2026-08-10T19:30:00.000Z"), waitMinutes: null })).toBe(
      "Today 01:30",
    );
  });

  it("states a wait when there is no slot", () => {
    expect(availableLabel({ slot: null, waitMinutes: 15 })).toBe("Walk in · ~15 min");
  });

  it("says 'no wait' rather than '~0 min'", () => {
    expect(availableLabel({ slot: null, waitMinutes: 0 })).toBe("Walk in · no wait");
    expect(availableLabel({ slot: null, waitMinutes: null })).toBe("Walk in · no wait");
  });

  it("prefers the slot when a salon has both", () => {
    // A bookable time is a commitment; a queue estimate is not. Naming the slot is the
    // stronger promise and the app makes the same choice.
    expect(
      availableLabel({ slot: new Date("2026-08-10T08:00:00.000Z"), waitMinutes: 5 }),
    ).toBe("Today 14:00");
  });
});
