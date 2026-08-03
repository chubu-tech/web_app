import { describe, expect, it } from "vitest";
import { kmTo, nearestSalons, withinDistance } from "./discover-logic";
import type { Business } from "./types/salon";

/**
 * A direct port of `tho/app/test/discover_logic_test.dart`.
 *
 * These exist to pin **unrounded** distance. latlong2 rounds in the target unit,
 * so the Dart original had to pass `roundResult: false`; the expectations below
 * are the fractional truth that proves it. Our `distanceKm` never rounds, but
 * the same cases guard against anyone "simplifying" it later.
 */

// Thimphu clock tower.
const ORIGIN = { lat: 27.4728, lng: 89.639 };

// Latitude-only offsets — ~110.8 km per degree here, so these distances are
// sub-kilometre and fractional. Rounding would collapse the first three onto
// 0.0 / 0.0 / 1.0 and break both the sort and a 1 km filter.
const NEAREST = { lat: 27.4738, lng: 89.639 }; // ~0.111 km
const NEAR = { lat: 27.4758, lng: 89.639 }; // ~0.332 km
const MID = { lat: 27.4838, lng: 89.639 }; // ~1.219 km
const FAR = { lat: 27.5808, lng: 89.639 }; // ~11.968 km

/** 10 m — far tighter than any rounding this guards against. */
const EPS = 0.01;

function biz(id: string, at?: { lat: number; lng: number }): Business {
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
    lat: at?.lat ?? null,
    lng: at?.lng ?? null,
    avgRating: null,
    reviewCount: 0,
    plan: "basic",
    businessType: "salon",
    serviceRadiusKm: null,
    whatsappPhone: null,
    queueEnabled: true,
    queueJoinMode: "anywhere",
    reminderChannel: "push",
  };
}

describe("kmTo", () => {
  it("null when the salon has no coordinates", () => {
    expect(kmTo(biz("b1"), ORIGIN)).toBeNull();
  });

  it("a real fractional distance, not a whole number of kilometres", () => {
    expect(kmTo(biz("b1", FAR), ORIGIN)!).toBeCloseTo(11.968, 1);
    expect(kmTo(biz("b2", MID), ORIGIN)!).toBeCloseTo(1.219, 1);
  });

  it("a salon a few hundred metres away is not reported as 0 km", () => {
    const km = kmTo(biz("b1", NEAR), ORIGIN)!;
    expect(Math.abs(km - 0.332)).toBeLessThan(EPS);
    expect(km).toBeGreaterThan(0); // "0.0 km" was the pre-fix reading
    expect(km).toBeLessThan(1);
  });
});

describe("withinDistance", () => {
  it("keeps a ~0.3 km salon and drops a ~12 km one at maxKm 5", () => {
    const near = biz("near", NEAR);
    const far = biz("far", FAR);
    expect(withinDistance([near, far], { from: ORIGIN, maxKm: 5 })).toEqual([near]);
  });

  it("maxKm 1 excludes a ~1.2 km salon", () => {
    // The rounding bug let this through: 1.219 rounded to 1.0, which satisfies
    // `<= 1`. Anything up to 1.49 km passed a 1 km filter.
    const near = biz("near", NEAR);
    const mid = biz("mid", MID);
    expect(withinDistance([near, mid], { from: ORIGIN, maxKm: 1 })).toEqual([near]);
  });

  it('drops a coordinate-less salon — unknown is not "within range"', () => {
    expect(withinDistance([biz("none")], { from: ORIGIN, maxKm: 1000 })).toEqual([]);
  });

  it("minKm excludes salons nearer than the range floor", () => {
    // The control is a two-thumb range, so "5 to 20 km" has a near side too —
    // it used to return the salon 0.3 km away.
    const near = biz("near", NEAR);
    const mid = biz("mid", MID);
    expect(withinDistance([near, mid], { from: ORIGIN, minKm: 1, maxKm: 5 })).toEqual([mid]);
  });

  it("minKm defaults to no lower bound", () => {
    const near = biz("near", NEAR);
    expect(withinDistance([near], { from: ORIGIN, maxKm: 5 })).toEqual([near]);
  });
});

describe("nearestSalons", () => {
  it("two salons ~220 m apart still sort nearest-first", () => {
    // The case rounding destroyed: both round to 0.0 km, so the comparator saw a
    // tie and an unstable sort ordered them arbitrarily — the Nearby row was not
    // actually ordered by distance.
    const nearest = biz("nearest", NEAREST);
    const near = biz("near", NEAR);
    const ranked = nearestSalons([near, nearest], { from: ORIGIN });
    expect(ranked.map((r) => r.business.id)).toEqual(["nearest", "near"]);
    expect(ranked[0].km).toBeLessThan(ranked[1].km);
  });

  it("sorts ascending by distance and honours limit", () => {
    const ranked = nearestSalons([biz("far", FAR), biz("none"), biz("near", NEAR)], {
      from: ORIGIN,
      limit: 1,
    });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].business.id).toBe("near");
    expect(Math.abs(ranked[0].km - 0.332)).toBeLessThan(EPS);
  });

  it("coordinate-less salons are omitted, not sorted arbitrarily", () => {
    const ranked = nearestSalons([biz("far", FAR), biz("none"), biz("near", NEAR)], {
      from: ORIGIN,
      limit: 5,
    });
    expect(ranked.map((r) => r.business.id)).toEqual(["near", "far"]);
  });

  it("empty when nothing has coordinates", () => {
    expect(nearestSalons([biz("a"), biz("b")], { from: ORIGIN })).toEqual([]);
  });
});
