import { describe, expect, it } from "vitest";
import {
  BACK_OFFICE_ROWS,
  OWNER_ROWS,
  SETUP_ROWS,
  tierNoteFor,
  type OwnerRow,
} from "./destinations";
import { hasFeature } from "../entitlements";

/**
 * The two invariants a drawer keeps breaking, held.
 *
 * Both of these reached production upstream — "Product orders" was gated and unmarked, and Staff
 * and Client book wore one glyph — and upstream's own note is that nothing could have caught
 * either, because the drawer was built inside a widget needing a live API. The same was true here
 * until the rows moved out of the component: the glyph collision was live in this repo, and the
 * tier line was written out by hand at four separate rows.
 */

const row = (href: string): OwnerRow => {
  const found = OWNER_ROWS.find((r) => r.href === href);
  if (!found) throw new Error(`no row for ${href}`);
  return found;
};

describe("the hub's rows", () => {
  it("gives every row its own glyph", () => {
    const icons = OWNER_ROWS.map((r) => r.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("gives every row its own route", () => {
    const hrefs = OWNER_ROWS.map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("keeps Client book and Staff apart, which is the collision that happened", () => {
    expect(row("/business/clients").icon).not.toBe(row("/business/staff").icon);
  });

  it("is the two groups and nothing else", () => {
    expect(OWNER_ROWS).toEqual([...SETUP_ROWS, ...BACK_OFFICE_ROWS]);
  });

  /**
   * Setting up a salon is not a paid feature. A Basic salon still has a name, hours, a menu and
   * a team, and gating any of that would be gating the product.
   */
  it("gates nothing in the setup group", () => {
    for (const r of SETUP_ROWS) expect(r.feature).toBeUndefined();
  });

  /**
   * Pinned as a list rather than derived, so **removing a `feature` from a row fails here**
   * instead of quietly un-marking it. That is the exact regression upstream shipped.
   */
  it("marks every gated back-office row", () => {
    const gated = BACK_OFFICE_ROWS.filter((r) => r.feature).map((r) => r.href);
    expect(gated).toEqual([
      "/business/clients",
      "/business/orders",
      "/business/products",
      "/business/loyalty",
      "/business/payroll",
      "/business/tax",
    ]);
  });
});

describe("tierNoteFor", () => {
  it("names the tier that actually unlocks the row", () => {
    expect(tierNoteFor(row("/business/clients"), "basic")).toBe("Growth plan and up");
    expect(tierNoteFor(row("/business/orders"), "basic")).toBe("Growth plan and up");
    expect(tierNoteFor(row("/business/loyalty"), "basic")).toBe("Growth plan and up");
    expect(tierNoteFor(row("/business/payroll"), "basic")).toBe("Pro plan and up");
    expect(tierNoteFor(row("/business/tax"), "growth")).toBe("Pro plan and up");
  });

  it("says nothing on a row the salon already has", () => {
    expect(tierNoteFor(row("/business/clients"), "growth")).toBeNull();
    expect(tierNoteFor(row("/business/payroll"), "pro")).toBeNull();
    for (const r of OWNER_ROWS) expect(tierNoteFor(r, "pro")).toBeNull();
  });

  it("says nothing on a row that was never gated", () => {
    expect(tierNoteFor(row("/business/offers"), "basic")).toBeNull();
    expect(tierNoteFor(row("/business/plans"), "basic")).toBeNull();
    expect(tierNoteFor(row("/business/hours"), "basic")).toBeNull();
  });

  /**
   * The property behind the two above: a note appears exactly when the plan lacks the feature.
   * A row marked while unlocked sends an owner to buy what they have; a row unmarked while
   * locked walks them into a screen whose every write refuses.
   */
  it("appears exactly when the feature is missing, on every plan", () => {
    for (const plan of ["basic", "growth", "pro"]) {
      for (const r of OWNER_ROWS) {
        const locked = r.feature != null && !hasFeature(plan, r.feature);
        expect(tierNoteFor(r, plan) != null).toBe(locked);
      }
    }
  });

  /** One phrasing across the whole console — the app unified three of these. */
  it("uses one phrasing", () => {
    const notes = OWNER_ROWS.map((r) => tierNoteFor(r, "basic")).filter(Boolean);
    expect(new Set(notes)).toEqual(new Set(["Growth plan and up", "Pro plan and up"]));
  });

  /** An unknown or missing plan fails locked, the way `planFromString` decides. */
  it("treats an unreadable plan as Basic", () => {
    expect(tierNoteFor(row("/business/loyalty"), null)).toBe("Growth plan and up");
    expect(tierNoteFor(row("/business/loyalty"), "enterprise")).toBe("Growth plan and up");
  });
});

describe("the labels the app settled on", () => {
  it("calls the tax screen an estimate, because that is what it computes", () => {
    expect(row("/business/tax").label).toBe("Tax estimate");
  });

  /**
   * "Plans & pricing", not "Plan & billing". There is no billing to reach — payment is off-app,
   * App Store Review Guideline 3.1.1 is why there never will be, and a row promising billing
   * promises a screen that cannot be built.
   */
  it("does not promise billing", () => {
    expect(row("/business/plans").label).toBe("Plans & pricing");
    for (const r of OWNER_ROWS) expect(r.label.toLowerCase()).not.toContain("billing");
  });
});
