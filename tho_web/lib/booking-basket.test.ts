import { describe, expect, it } from "vitest";
import {
  basketDuration,
  basketTotal,
  bookableServices,
  eligibleStaff,
  dayPartOf,
  filterByGender,
  groupByDayPart,
  noSlotsForSelection,
  serviceCategories,
  staffStillEligible,
} from "./booking-basket";
import { EMPTY_FILTERS, GENDER_SERVICE_KINDS, serviceGenders } from "./salon-filters";
import type { ServiceItem, StaffMember } from "./types/salon";

function service(over: Partial<ServiceItem> & { id: string }): ServiceItem {
  return {
    name: over.id,
    description: null,
    durationMinutes: 30,
    price: 100,
    isActive: true,
    imageUrl: null,
    gender: null,
    catalogId: null,
    category: null,
    ...over,
  };
}

function member(id: string): StaffMember {
  return {
    id,
    displayName: id,
    role: "Stylist",
    isActive: true,
    profileId: null,
    photoUrl: null,
    businessId: "b1",
    commissionPct: 0,
    baseSalaryNu: 0,
  } as StaffMember;
}

describe("basket arithmetic", () => {
  it("sums price and duration", () => {
    const items = [
      service({ id: "a", price: 150, durationMinutes: 20 }),
      service({ id: "b", price: 450, durationMinutes: 45 }),
    ];
    expect(basketTotal(items)).toBe(600);
    expect(basketDuration(items)).toBe(65);
  });

  it("is zero on an empty basket rather than NaN", () => {
    expect(basketTotal([])).toBe(0);
    expect(basketDuration([])).toBe(0);
  });
});

describe("eligibleStaff", () => {
  // Norzin's live shape: two stylists, and services they do not both perform.
  const staff = [member("sonam"), member("dechen")];
  const map: Record<string, string[]> = {
    cut: ["sonam", "dechen"],
    beard: ["sonam"],
    colour: [],
  };

  it("intersects — a stylist must perform every service in the basket", () => {
    expect(eligibleStaff(["cut", "beard"], map, staff).map((s) => s.id)).toEqual(["sonam"]);
  });

  it("does not union — one shared service is not enough", () => {
    // `dechen` performs `cut`, so a union would wrongly keep her for `cut` + `beard`.
    expect(eligibleStaff(["cut", "beard"], map, staff).map((s) => s.id)).not.toContain(
      "dechen",
    );
  });

  it("returns everyone for an empty basket — nothing has been narrowed yet", () => {
    expect(eligibleStaff([], map, staff)).toHaveLength(2);
  });

  it("returns nobody when a service is mapped to nobody", () => {
    expect(eligibleStaff(["colour"], map, staff)).toEqual([]);
    expect(eligibleStaff(["cut", "colour"], map, staff)).toEqual([]);
  });

  it("returns nobody for a service id the map has never heard of", () => {
    expect(eligibleStaff(["ghost"], map, staff)).toEqual([]);
  });
});

describe("staffStillEligible", () => {
  const map: Record<string, string[]> = { cut: ["sonam", "dechen"], beard: ["sonam"] };

  it("is true while the stylist performs everything selected", () => {
    expect(staffStillEligible("sonam", ["cut", "beard"], map)).toBe(true);
  });

  it("goes false the moment an unperformable service joins the basket", () => {
    expect(staffStillEligible("dechen", ["cut"], map)).toBe(true);
    expect(staffStillEligible("dechen", ["cut", "beard"], map)).toBe(false);
  });
});

describe("bookableServices", () => {
  it("drops services no stylist performs", () => {
    const items = [service({ id: "cut" }), service({ id: "colour" })];
    const map = { cut: ["sonam"], colour: [] };
    expect(bookableServices(items, map).map((s) => s.id)).toEqual(["cut"]);
  });

  it("drops a service absent from the map entirely", () => {
    expect(bookableServices([service({ id: "cut" })], {})).toEqual([]);
  });
});

describe("serviceCategories", () => {
  it("is empty below two groups — one chip is a label, not a filter", () => {
    expect(serviceCategories([service({ id: "a", category: "Hair" })])).toEqual([]);
    expect(
      serviceCategories([
        service({ id: "a", category: "Hair" }),
        service({ id: "b", category: "Hair" }),
      ]),
    ).toEqual([]);
  });

  it("keeps first-seen order — the salon's own", () => {
    expect(
      serviceCategories([
        service({ id: "a", category: "Spa" }),
        service({ id: "b", category: "Hair" }),
        service({ id: "c", category: "Spa" }),
      ]),
    ).toEqual(["Spa", "Hair"]);
  });

  it("ignores null and blank, which is 31 of the 33 live rows", () => {
    expect(
      serviceCategories([
        service({ id: "a", category: null }),
        service({ id: "b", category: "   " }),
        service({ id: "c", category: "Hair" }),
      ]),
    ).toEqual([]);
  });
});

/*
  `filterByGender` — the service step's own chip row, ported from
  `../tho/app/lib/customer/booking/service_filters.dart:33`.

  It reads `GENDER_SERVICE_KINDS` from `salon-filters.ts`, the same map Discover's server-side
  query uses, so the two cannot disagree about what "Women" admits. The null case is the one
  that matters on live data.
*/
describe("filterByGender", () => {
  const women = service({ id: "w", gender: "female" });
  const men = service({ id: "m", gender: "male" });
  const both = service({ id: "u", gender: "unisex" });
  const unset = service({ id: "n", gender: null });
  const all = [women, men, both, unset];

  it("Women admits female and unisex", () => {
    expect(filterByGender(all, "women").map((s) => s.id)).toEqual(["w", "u", "n"]);
  });

  it("Men admits male and unisex", () => {
    expect(filterByGender(all, "men").map((s) => s.id)).toEqual(["m", "u", "n"]);
  });

  it("treats a NULL gender as unisex, because most live services have none", () => {
    /*
      24 of the 34 live services have no `gender`. Reading null as "unknown, hide it" would
      empty most real menus — which is the same conclusion `api/discovery.ts` reached for the
      cross-salon query, from the same data.
    */
    expect(filterByGender([unset], "women")).toHaveLength(1);
    expect(filterByGender([unset], "men")).toHaveLength(1);
  });

  it("shows everything for `any` and for anything it does not recognise", () => {
    // The safe direction: an unrecognised value must show too much, never too little.
    expect(filterByGender(all, "any")).toHaveLength(4);
    expect(filterByGender(all, "")).toHaveLength(4);
    expect(filterByGender(all, "nonbinary")).toHaveLength(4);
  });

  it("offers no Unisex choice, because unisex is part of both", () => {
    // Pinned as a decision rather than an omission: a third chip would present unisex
    // services as a separate menu instead of as part of both.
    expect(Object.keys(GENDER_SERVICE_KINDS).sort()).toEqual(["men", "women"]);
  });

  it("agrees with Discover's server-side filter, key for key", () => {
    // The drift this map exists to prevent, asserted directly.
    expect(serviceGenders({ ...EMPTY_FILTERS, gender: "women" })).toEqual([
      ...GENDER_SERVICE_KINDS.women!,
    ]);
    expect(serviceGenders({ ...EMPTY_FILTERS, gender: "men" })).toEqual([
      ...GENDER_SERVICE_KINDS.men!,
    ]);
    expect(serviceGenders({ ...EMPTY_FILTERS, gender: "any" })).toBeNull();
  });

  it("never mutates its input", () => {
    const input = [women, men];
    filterByGender(input, "any");
    expect(input.map((s) => s.id)).toEqual(["w", "m"]);
  });
});

/*
  The slot grid's three blocks, ported from `_groupByDayPart` (`time_step.dart:504`).

  The cut points are trivial; the timezone is not, and it is A1-11 upstream. Every case below
  uses a UTC instant whose Thimphu hour lands in a *different* block from its UTC hour, so a
  version reading the browser's clock fails all of them.
*/
describe("dayPartOf", () => {
  // 03:00Z is 09:00 Thimphu — morning there, and still the small hours in London.
  it("is morning before noon Thimphu", () => {
    expect(dayPartOf(new Date("2026-08-10T03:00:00.000Z"))).toBe("morning");
  });

  it("is afternoon from noon", () => {
    // 06:00Z is exactly 12:00 Thimphu — the boundary belongs to afternoon.
    expect(dayPartOf(new Date("2026-08-10T06:00:00.000Z"))).toBe("afternoon");
    expect(dayPartOf(new Date("2026-08-10T05:59:00.000Z"))).toBe("morning");
  });

  it("is evening from 17:00", () => {
    // 11:00Z is 17:00 Thimphu.
    expect(dayPartOf(new Date("2026-08-10T11:00:00.000Z"))).toBe("evening");
    expect(dayPartOf(new Date("2026-08-10T10:59:00.000Z"))).toBe("afternoon");
  });

  it("files a late slot by the SALON's clock, not the viewer's", () => {
    /*
      The case that makes this worth a function. 16:30Z is 22:30 in Thimphu — plainly evening
      at the salon — while a browser in UTC would read 16:30 and call it afternoon, putting a
      chip labelled 22:30 under an "Afternoon" heading on the same screen.
    */
    expect(dayPartOf(new Date("2026-08-10T16:30:00.000Z"))).toBe("evening");
  });

  it("a slot after Thimphu midnight is morning, though it is still yesterday in UTC", () => {
    // 19:30Z on the 10th is 01:30 on the 11th in Thimphu.
    expect(dayPartOf(new Date("2026-08-10T19:30:00.000Z"))).toBe("morning");
  });
});

describe("groupByDayPart", () => {
  const at = (iso: string) => ({ start: new Date(iso) });
  const startOf = (s: { start: Date }) => s.start;

  it("returns the blocks in order", () => {
    const groups = groupByDayPart(
      [
        at("2026-08-10T11:30:00.000Z"), // 17:30 evening
        at("2026-08-10T03:00:00.000Z"), // 09:00 morning
        at("2026-08-10T07:00:00.000Z"), // 13:00 afternoon
      ],
      startOf,
    );
    expect(groups.map((g) => g.part)).toEqual(["morning", "afternoon", "evening"]);
    expect(groups.map((g) => g.label)).toEqual(["Morning", "Afternoon", "Evening"]);
  });

  it("omits a block with nothing in it — no heading over an empty grid", () => {
    // A salon opening at 13:00 has no morning at all, which is the live shape for a shop that
    // starts after lunch.
    const groups = groupByDayPart(
      [at("2026-08-10T07:00:00.000Z"), at("2026-08-10T11:30:00.000Z")],
      startOf,
    );
    expect(groups.map((g) => g.part)).toEqual(["afternoon", "evening"]);
  });

  it("keeps every slot, in the order given, inside its block", () => {
    const groups = groupByDayPart(
      [
        at("2026-08-10T04:00:00.000Z"), // 10:00
        at("2026-08-10T03:00:00.000Z"), // 09:00
      ],
      startOf,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.slots.map((s) => s.start.toISOString())).toEqual([
      "2026-08-10T04:00:00.000Z",
      "2026-08-10T03:00:00.000Z",
    ]);
  });

  it("is empty for no slots, so the caller renders its own empty state", () => {
    expect(groupByDayPart([], startOf)).toEqual([]);
  });
});

/*
  `noSlotsForSelection` — why a day is empty, ported from `service_selection.dart:113`.

  It exists because "the day is full" and "your basket needs one unbroken block" are different
  problems: `is_bookable_window` requires the whole basket inside ONE working-hours interval, so
  a long basket can find nothing on a day with plenty of short gaps.
*/
describe("noSlotsForSelection", () => {
  const day = new Date("2026-08-14T06:00:00.000Z"); // a Friday in Thimphu

  it("names the block, the stylist and the day", () => {
    const msg = noSlotsForSelection({
      services: [service({ id: "a", durationMinutes: 90 })],
      staffName: "Sonam",
      day,
    });
    expect(msg).toBe("No slot fits 1 hr 30 min with Sonam on Fri — try another day.");
  });

  it("suggests fewer services ONLY when there is more than one to drop", () => {
    // Advice somebody cannot take is worse than no advice.
    const one = noSlotsForSelection({ services: [service({ id: "a" })], staffName: "S", day });
    expect(one).not.toContain("fewer services");

    const two = noSlotsForSelection({
      services: [service({ id: "a" }), service({ id: "b" })],
      staffName: "S",
      day,
    });
    expect(two).toContain("or fewer services.");
  });

  it("sums the basket's duration", () => {
    const msg = noSlotsForSelection({
      services: [service({ id: "a", durationMinutes: 45 }), service({ id: "b", durationMinutes: 45 })],
      staffName: "S",
      day,
    });
    expect(msg).toContain("1 hr 30 min");
  });

  it("names the day in Thimphu, not the viewer's zone", () => {
    /*
      19:00Z on Friday the 14th is 01:00 on SATURDAY in Thimphu. A message naming Friday would
      be pointing the customer at the wrong day of the salon's week.
    */
    const msg = noSlotsForSelection({
      services: [service({ id: "a" })],
      staffName: "S",
      day: new Date("2026-08-14T19:00:00.000Z"),
    });
    expect(msg).toContain("on Sat");
  });
});
