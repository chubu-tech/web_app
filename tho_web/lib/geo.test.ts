import { describe, expect, it } from "vitest";
import { MAX_PLAUSIBLE_KM, plausibleFix, THIMPHU_CENTER } from "./geo";
import { distanceKm } from "./booking-guards";

/**
 * The guard has no Dart test to port — `_resolveLocation` is untested in the app —
 * and no live data can exercise it, since every salon on the platform is in Bhutan.
 * So it gets its own cases: this is the only thing standing between a bad fix and a
 * "nearby" list in a meaningless order.
 */
describe("plausibleFix", () => {
  it("keeps a fix inside Bhutan", () => {
    const paro = { lat: 27.4305, lng: 89.4164 }; // ~22 km from Thimphu
    expect(plausibleFix(paro)).toEqual(paro);
  });

  it("keeps the Thimphu centre itself", () => {
    expect(plausibleFix(THIMPHU_CENTER)).toEqual(THIMPHU_CENTER);
  });

  it("falls back for a fix on another continent", () => {
    const london = { lat: 51.5072, lng: -0.1276 };
    expect(distanceKm(THIMPHU_CENTER, london)).toBeGreaterThan(MAX_PLAUSIBLE_KM);
    expect(plausibleFix(london)).toEqual(THIMPHU_CENTER);
  });

  it("falls back just outside the radius and keeps just inside it", () => {
    // ~1 degree of latitude is ~111 km, so 1.2° north is ~133 km (inside) and
    // 1.5° is ~167 km (outside). Asserted against the same helper the guard uses,
    // so the test can't drift from the implementation's idea of a kilometre.
    const inside = { lat: THIMPHU_CENTER.lat + 1.2, lng: THIMPHU_CENTER.lng };
    const outside = { lat: THIMPHU_CENTER.lat + 1.5, lng: THIMPHU_CENTER.lng };
    expect(distanceKm(THIMPHU_CENTER, inside)).toBeLessThan(MAX_PLAUSIBLE_KM);
    expect(distanceKm(THIMPHU_CENTER, outside)).toBeGreaterThan(MAX_PLAUSIBLE_KM);
    expect(plausibleFix(inside)).toEqual(inside);
    expect(plausibleFix(outside)).toEqual(THIMPHU_CENTER);
  });

  it("falls back for the null island, which is what a zeroed sensor reports", () => {
    expect(plausibleFix({ lat: 0, lng: 0 })).toEqual(THIMPHU_CENTER);
  });
});
