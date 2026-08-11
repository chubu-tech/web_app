import { describe, expect, it } from "vitest";
import {
  MAX_PLAUSIBLE_KM,
  mapCenter,
  nearestTo,
  plausibleFix,
  THIMPHU_CENTER,
} from "./geo";
import { distanceKm } from "./booking-guards";
import type { Business } from "./types/salon";

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

/**
 * The map's two helpers, ported from `map_logic_test.dart` with the same fixtures:
 * three salons around Thimphu, one of them ~22 km out at Paro.
 */
function salon(id: string, lat: number, lng: number): Business {
  return {
    id,
    name: `Salon ${id}`,
    description: null,
    addressText: null,
    phone: null,
    coverUrl: null,
    timezone: "Asia/Thimphu",
    cancellationWindowHours: 2,
    isActive: true,
    lat,
    lng,
    avgRating: null,
    reviewCount: 0,
    plan: "basic",
    businessType: "salon",
    serviceRadiusKm: null,
    whatsappPhone: null,
    queueEnabled: false,
    queueJoinMode: "anywhere",
    reminderChannel: "push",
    monthlyRevenueGoal: null,
    rebookingEnabled: false,
    rebookingDays: 30,
  };
}

const clockTower = salon("a", 27.4712, 89.6339);
const motithang = salon("b", 27.4869, 89.6203);
const paro = salon("c", 27.4287, 89.4164);

describe("nearestTo", () => {
  it("picks the salon closest to the centre", () => {
    // `map_logic_test.dart:17` — deliberately unsorted, and the answer is not first.
    expect(nearestTo(THIMPHU_CENTER, [paro, motithang, clockTower])?.id).toBe("a");
  });

  it("returns null for an empty list", () => {
    expect(nearestTo(THIMPHU_CENTER, [])).toBeNull();
  });

  it("skips a salon with no coordinates rather than treating it as distance zero", () => {
    // 2 of 13 live salons have no lat/lng. `kmTo` returns null for them, and null
    // must not compare as nearest — which is what `Business.lat!` would crash on in
    // the Dart and what a `?? 0` would get wrong here.
    const unlocated = { ...salon("d", 0, 0), lat: null, lng: null };
    expect(nearestTo(THIMPHU_CENTER, [unlocated, paro])?.id).toBe("c");
    expect(nearestTo(THIMPHU_CENTER, [unlocated])).toBeNull();
  });

  it("breaks an exact tie in favour of the earlier salon", () => {
    // `Test 01` and `Test 2` are 6 m apart on live data, so this decides which of
    // them opens selected. The Dart's `km(a) <= km(b)` keeps the earlier one.
    const first = salon("first", 27.432422, 89.654047);
    const second = salon("second", 27.432422, 89.654047);
    expect(nearestTo(THIMPHU_CENTER, [first, second])?.id).toBe("first");
    expect(nearestTo(THIMPHU_CENTER, [second, first])?.id).toBe("second");
  });
});

describe("mapCenter", () => {
  const salons = [clockTower, motithang, paro];

  it("falls back to Thimphu without a usable fix", () => {
    // `map_logic_test.dart:30`, reached here through `resolveLocation`'s fallback
    // rather than through a null.
    expect(mapCenter({ coords: THIMPHU_CENTER, source: "fallback" })).toEqual(
      THIMPHU_CENTER,
    );
  });

  it("keeps a GPS fix near the salons", () => {
    const nearParo = { lat: 27.43, lng: 89.42 };
    expect(mapCenter({ coords: plausibleFix(nearParo), source: "gps" })).toEqual(nearParo);
  });

  it("snaps a far-away fix (the simulator default) to Thimphu", () => {
    // The one case where the reconciliation is visible: the app measures 150 km from
    // the nearest salon, this measures it from the Thimphu centre. Both reject
    // Cupertino, and `salons` is here to show the answer no longer depends on it.
    const cupertino = { lat: 37.323, lng: -122.0322 };
    expect(salons.length).toBe(3);
    expect(mapCenter({ coords: plausibleFix(cupertino), source: "gps" })).toEqual(
      THIMPHU_CENTER,
    );
  });

  it("does NOT keep a far fix when no salon has a location — the one divergence", () => {
    // `map_logic_test.dart:44` asserts the opposite: `effectiveCenter(anywhere, [])`
    // returns `anywhere`, because with no salon to measure from the guard has no
    // reference point. That branch is unreachable in the app — `MapTab` renders the
    // "No mapped salons" empty state instead of a map — and opening on the Pacific
    // is not behaviour worth carrying. Measuring from Thimphu needs no salon list,
    // so the guard simply still applies.
    const anywhere = { lat: 10, lng: 10 };
    expect(mapCenter({ coords: plausibleFix(anywhere), source: "gps" })).toEqual(
      THIMPHU_CENTER,
    );
  });
});
