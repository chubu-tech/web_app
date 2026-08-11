import { describe, expect, it } from "vitest";
import { resolveActiveBusinessId } from "./active-business";

/**
 * The first three cases are ports of what `resolveActiveBusinessId` guarantees in
 * `tho/app/lib/business/business_home.dart`. The rest are web-only: the app's saved
 * value comes from its own `SharedPreferences` and cannot be tampered with, whereas
 * this one arrives in a cookie.
 */
describe("resolveActiveBusinessId", () => {
  const owned = ["norzin", "menjong", "kira"];

  it("keeps the saved salon while it is still owned", () => {
    expect(resolveActiveBusinessId(owned, "menjong")).toBe("menjong");
  });

  it("falls back to the first when nothing is saved", () => {
    expect(resolveActiveBusinessId(owned, null)).toBe("norzin");
    expect(resolveActiveBusinessId(owned, undefined)).toBe("norzin");
  });

  it("falls back to the first when the saved salon is no longer owned", () => {
    // A salon can be sold, deleted or reassigned between visits, and the cookie
    // outlives all three.
    expect(resolveActiveBusinessId(owned, "sold-last-year")).toBe("norzin");
  });

  it("returns null for an owner with no salons", () => {
    // `role = 'owner'` with zero rows in `businesses` is reachable: an operator can
    // create the account before the salon. The console shows a "no salon yet" state.
    expect(resolveActiveBusinessId([], "norzin")).toBeNull();
    expect(resolveActiveBusinessId([], null)).toBeNull();
  });

  it("never honours a forged cookie naming someone else's salon", () => {
    // The whole reason this is a function and not a cookie read. RLS would refuse the
    // rows regardless, but the console must not look like it switched.
    expect(resolveActiveBusinessId(owned, "0b000000-somebody-elses")).toBe("norzin");
  });

  it("ignores an empty-string cookie rather than treating it as a salon", () => {
    expect(resolveActiveBusinessId(owned, "")).toBe("norzin");
  });
});
