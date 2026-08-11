import { describe, expect, it } from "vitest";
import { rebookSubtitle, rebookable, resolveRebook } from "./rebook";
import type { Booking, BookingStatus } from "./types/booking";
import type { ServiceItem, StaffMember } from "./types/salon";

/**
 * A port of `../tho/app/lib/customer/booking/rebook_resolver.dart` and
 * `BookAgainRow.rebookable`.
 *
 * The point of the resolver is that it distrusts the past booking: every case below is
 * about what has changed at the salon since the customer was last there.
 */

function svc(id: string, over: Partial<ServiceItem> = {}): ServiceItem {
  return {
    id,
    name: `Service ${id}`,
    description: null,
    durationMinutes: 30,
    price: 400,
    isActive: true,
    imageUrl: null,
    gender: null,
    catalogId: null,
    category: null,
    ...over,
  };
}

function person(id: string, over: Partial<StaffMember> = {}): StaffMember {
  return {
    id,
    displayName: `Stylist ${id}`,
    role: "stylist",
    isActive: true,
    profileId: null,
    photoUrl: null,
    businessId: "b1",
    commissionPct: 0,
    baseSalaryNu: 0,
    ...over,
  };
}

function past(
  serviceIds: string[],
  { staffMemberId = "s1", status = "completed" as BookingStatus, businessId = "b1" } = {},
): Booking {
  return {
    id: `bk-${serviceIds.join("-")}`,
    status,
    startTs: new Date("2026-07-01T04:00:00.000Z"),
    endTs: new Date("2026-07-01T05:00:00.000Z"),
    totalPrice: 400,
    businessId,
    staffMemberId,
    items: serviceIds.map((sid) => ({
      id: `it-${sid}`,
      serviceId: sid,
      name: `Service ${sid}`,
      price: 400,
      durationMinutes: 30,
    })),
  };
}

describe("resolveRebook — nothing has changed", () => {
  it("goes straight to the time step with the basket and the stylist", () => {
    const r = resolveRebook({
      booking: past(["a"]),
      menu: [svc("a")],
      staff: [person("s1")],
      staffByService: { a: ["s1"] },
    });
    expect(r.step).toBe("time");
    expect(r.services.map((s) => s.id)).toEqual(["a"]);
    expect(r.staff?.id).toBe("s1");
    expect(r.changeNote).toBeNull();
  });

  it("returns services in MENU order, not booking order", () => {
    /*
      The flow renders the basket against the menu, so matching the menu's order is what
      stops step 1 appearing to reshuffle itself as it opens. The booking here names them
      backwards on purpose.
    */
    const r = resolveRebook({
      booking: past(["b", "a"]),
      menu: [svc("a"), svc("b")],
      staff: [person("s1")],
      staffByService: { a: ["s1"], b: ["s1"] },
    });
    expect(r.services.map((s) => s.id)).toEqual(["a", "b"]);
    expect(r.step).toBe("time");
  });
});

describe("resolveRebook — a service is gone", () => {
  it("falls back to step 1 and says so", () => {
    const r = resolveRebook({
      booking: past(["a", "gone"]),
      menu: [svc("a")],
      staff: [person("s1")],
      staffByService: { a: ["s1"] },
    });
    expect(r.step).toBe("services");
    expect(r.services.map((s) => s.id)).toEqual(["a"]);
    expect(r.changeNote).toBe("A service from last time is no longer offered.");
  });

  it("treats a deactivated service as gone", () => {
    // Still on the menu, still readable, and `create_booking` refuses it.
    const r = resolveRebook({
      booking: past(["a"]),
      menu: [svc("a", { isActive: false })],
      staff: [person("s1")],
      staffByService: { a: ["s1"] },
    });
    expect(r.step).toBe("services");
    expect(r.services).toEqual([]);
    expect(r.changeNote).not.toBeNull();
  });

  it("carries no stylist even when the stylist is still fine", () => {
    // The basket is wrong, so the stylist is not yet a question worth answering.
    const r = resolveRebook({
      booking: past(["a", "gone"]),
      menu: [svc("a")],
      staff: [person("s1")],
      staffByService: { a: ["s1"] },
    });
    expect(r.staff).toBeNull();
  });

  it("says nothing when every service survived", () => {
    const r = resolveRebook({
      booking: past(["a", "b"]),
      menu: [svc("a"), svc("b")],
      staff: [person("s1")],
      staffByService: { a: ["s1"], b: ["s1"] },
    });
    expect(r.changeNote).toBeNull();
  });
});

describe("resolveRebook — the stylist", () => {
  it("forces step 2 when they have left", () => {
    // No banner: step 2 opens with the roster, which says it better than a sentence.
    const r = resolveRebook({
      booking: past(["a"], { staffMemberId: "departed" }),
      menu: [svc("a")],
      staff: [person("s1")],
      staffByService: { a: ["s1"] },
    });
    expect(r.step).toBe("professional");
    expect(r.staff).toBeNull();
    expect(r.changeNote).toBeNull();
  });

  it("forces step 2 when they are inactive", () => {
    const r = resolveRebook({
      booking: past(["a"]),
      menu: [svc("a")],
      staff: [person("s1", { isActive: false })],
      staffByService: { a: ["s1"] },
    });
    expect(r.step).toBe("professional");
  });

  it("forces step 2 when they no longer do everything in the basket", () => {
    const r = resolveRebook({
      booking: past(["a", "b"]),
      menu: [svc("a"), svc("b")],
      staff: [person("s1")],
      staffByService: { a: ["s1"], b: ["s2"] },
    });
    expect(r.step).toBe("professional");
    expect(r.services.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("forces step 2 when the booking recorded no stylist at all", () => {
    const r = resolveRebook({
      booking: past(["a"], { staffMemberId: null as unknown as string }),
      menu: [svc("a")],
      staff: [person("s1")],
      staffByService: { a: ["s1"] },
    });
    expect(r.step).toBe("professional");
  });

  it("survives an UNREAD mapping rather than failing closed", () => {
    /*
      The nuance the Dart spells out: the `service_staff` read is decorative, and a failed
      one must not make a salon unbookable. An empty map means "not read" — the stylist is
      kept and `create_booking` remains the authority. A *populated* map that omits them is
      a different fact and rules them out (the case above).
    */
    const r = resolveRebook({
      booking: past(["a"]),
      menu: [svc("a")],
      staff: [person("s1")],
      staffByService: {},
    });
    expect(r.step).toBe("time");
    expect(r.staff?.id).toBe("s1");
  });
});

describe("rebookable", () => {
  const bk = (id: string, businessId: string, day: number, status: BookingStatus = "completed") =>
    ({
      id,
      status,
      startTs: new Date(Date.UTC(2026, 6, day)),
      endTs: new Date(Date.UTC(2026, 6, day, 1)),
      totalPrice: 0,
      businessId,
    }) as Booking;

  it("is newest first", () => {
    const out = rebookable([bk("old", "b1", 1), bk("new", "b2", 20), bk("mid", "b3", 10)]);
    expect(out.map((b) => b.id)).toEqual(["new", "mid", "old"]);
  });

  it("keeps ONE booking per salon — the newest", () => {
    // A weekly regular would otherwise see the same shop three times and be offered no
    // choice at all, which is the opposite of what a row of three cards is for.
    const out = rebookable([bk("wk1", "b1", 1), bk("wk3", "b1", 21), bk("wk2", "b1", 14)]);
    expect(out.map((b) => b.id)).toEqual(["wk3"]);
  });

  it("caps at three by default", () => {
    const out = rebookable([1, 2, 3, 4, 5].map((n) => bk(`b${n}`, `biz${n}`, n)));
    expect(out).toHaveLength(3);
    expect(rebookable([1, 2, 3, 4, 5].map((n) => bk(`b${n}`, `biz${n}`, n)), 2)).toHaveLength(2);
  });

  it("ignores anything not completed", () => {
    const out = rebookable([
      bk("cancelled", "b1", 5, "cancelled"),
      bk("upcoming", "b2", 6, "confirmed"),
      bk("noshow", "b3", 7, "no_show"),
      bk("done", "b4", 8),
    ]);
    expect(out.map((b) => b.id)).toEqual(["done"]);
  });

  it("ignores a booking with no salon, which has nothing to rebook at", () => {
    const orphan = { ...bk("orphan", "x", 9), businessId: undefined } as Booking;
    expect(rebookable([orphan])).toEqual([]);
  });

  it("is empty for a customer with no history", () => {
    expect(rebookable([])).toEqual([]);
  });
});

describe("rebookSubtitle", () => {
  /** `past()` records no stylist name, so add one where the test is about it. */
  const withStylist = (b: Booking, staffName: string): Booking => ({ ...b, staffName });

  it("names one service and counts the rest", () => {
    expect(rebookSubtitle(withStylist(past(["a", "b", "c"]), "Asha"))).toBe(
      "Service a +2 · Asha",
    );
  });

  it("names a single service in full", () => {
    expect(rebookSubtitle(withStylist(past(["a"]), "Asha"))).toBe("Service a · Asha");
  });

  it("drops the separator when no stylist was recorded", () => {
    // A walk-in booked at the counter often has none, and a trailing " · " on a card is
    // the kind of thing that ships.
    expect(rebookSubtitle(past(["a", "b"]))).toBe("Service a +1");
  });

  it("falls back to the stylist alone when the booking kept no line items", () => {
    const bare = { ...withStylist(past(["a"]), "Asha"), items: [] } as Booking;
    expect(rebookSubtitle(bare)).toBe("Asha");
  });

  it("is empty rather than stray punctuation when it knows neither", () => {
    const bare = { ...past(["a"]), items: [] } as Booking;
    expect(rebookSubtitle(bare)).toBe("");
  });
});
