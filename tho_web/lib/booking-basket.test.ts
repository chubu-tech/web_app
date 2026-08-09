import { describe, expect, it } from "vitest";
import {
  basketDuration,
  basketTotal,
  bookableServices,
  eligibleStaff,
  serviceCategories,
  staffStillEligible,
} from "./booking-basket";
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
