import { describe, expect, it } from "vitest";
import {
  DISTANCE_DEFAULT,
  EMPTY_FILTERS,
  PRICE_DEFAULT,
  fromParams,
  hasDistance,
  hasGender,
  hasPrice,
  isActive,
  minDistanceKm,
  serviceGenders,
  toParams,
  type SalonFilters,
} from "./salon-filters";

/**
 * A port of `tho/app/test/salon_filters_test.dart`, plus cases for the
 * URL round-trip, which is web-only and has no Dart equivalent.
 */

const filters = (patch: Partial<SalonFilters> = {}): SalonFilters => ({
  ...EMPTY_FILTERS,
  ...patch,
});

describe("defaults", () => {
  it("distance defaults to 1-50 km", () => {
    expect(DISTANCE_DEFAULT).toEqual({ start: 1, end: 50 });
    expect(filters().distance).toEqual({ start: 1, end: 50 });
  });

  it("price defaults to Nu 100-2000", () => {
    expect(PRICE_DEFAULT).toEqual({ start: 100, end: 2000 });
    expect(filters().price).toEqual({ start: 100, end: 2000 });
  });
});

describe("has*/isActive at defaults", () => {
  it("all false", () => {
    const f = filters();
    expect(hasGender(f)).toBe(false);
    expect(hasPrice(f)).toBe(false);
    expect(hasDistance(f)).toBe(false);
    expect(isActive(f)).toBe(false);
  });
});

describe("each control flips isActive once moved", () => {
  it("gender", () => {
    const f = filters({ gender: "women" });
    expect(hasGender(f)).toBe(true);
    expect(isActive(f)).toBe(true);
  });

  it("categoryId", () => {
    expect(isActive(filters({ categoryId: "cat-1" }))).toBe(true);
  });

  it("minRating", () => {
    expect(isActive(filters({ minRating: 4.0 }))).toBe(true);
  });

  it("distance", () => {
    const f = filters({ distance: { start: 2, end: 40 } });
    expect(hasDistance(f)).toBe(true);
    expect(isActive(f)).toBe(true);
  });

  it("price", () => {
    const f = filters({ price: { start: 200, end: 1500 } });
    expect(hasPrice(f)).toBe(true);
    expect(isActive(f)).toBe(true);
  });
});

describe("minDistanceKm", () => {
  it("null at the range floor — the lower thumb was never moved", () => {
    // 1 km is the smallest lower bound the slider can express, so someone who
    // only dragged the *upper* thumb ("anywhere up to 5 km") has not asked to
    // hide the salon next door.
    expect(minDistanceKm(filters())).toBeNull();
    expect(minDistanceKm(filters({ distance: { start: 1, end: 5 } }))).toBeNull();
  });

  it("the lower bound once it is raised off the floor", () => {
    expect(minDistanceKm(filters({ distance: { start: 10, end: 20 } }))).toBe(10);
  });
});

describe("serviceGenders", () => {
  it("women maps to female + unisex", () => {
    expect(serviceGenders(filters({ gender: "women" }))).toEqual(["female", "unisex"]);
  });

  it("men maps to male + unisex", () => {
    expect(serviceGenders(filters({ gender: "men" }))).toEqual(["male", "unisex"]);
  });

  it("any maps to null (no constraint)", () => {
    expect(serviceGenders(filters({ gender: "any" }))).toBeNull();
    expect(serviceGenders(filters())).toBeNull();
  });
});

describe("URL round-trip (web only)", () => {
  it("defaults produce an empty query, so a clean view has a clean URL", () => {
    expect(toParams(filters())).toEqual({});
  });

  it("round-trips every moved control", () => {
    const f = filters({
      gender: "men",
      categoryId: "cat-9",
      minRating: 4.5,
      distance: { start: 10, end: 20 },
      price: { start: 200, end: 1500 },
    });
    expect(fromParams(toParams(f))).toEqual(f);
  });

  it("clamps hand-edited distances into the slider's range", () => {
    const f = fromParams({ kmMin: "-5", kmMax: "999" });
    expect(f.distance).toEqual({ start: 1, end: 50 });
  });

  it("ignores a rating that is not one of the offered tiers", () => {
    // A hand-edited URL must not invent a filter the UI cannot display.
    expect(fromParams({ minRating: "4.2" }).minRating).toBeNull();
    expect(fromParams({ minRating: "4.5" }).minRating).toBe(4.5);
  });

  it("ignores junk rather than throwing", () => {
    const f = fromParams({ gender: "nope", kmMin: "abc", minRating: "x" });
    expect(f.gender).toBe("any");
    expect(f.distance).toEqual({ start: 1, end: 50 });
    expect(f.minRating).toBeNull();
  });
});
