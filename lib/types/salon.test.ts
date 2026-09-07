import { describe, expect, it } from "vitest";
import { discountPercent, isAwaitingReview, isDiscounted, isListed, runsQueue } from "./salon";

/**
 * `runsQueue` is the predicate the owner's queue board gates on, and it is now a single
 * condition: **the owner's own switch.**
 *
 * It used to AND that switch with a plan entitlement, and the cases below are the old ones
 * inverted rather than deleted, because the inversion is the point. Migration
 * `20260902000003_queue_for_all_plans.sql` removed the `plan in ('growth','pro')` gate from
 * `join_queue`, `check_in_booking` and `queue_active_line`, so a **Basic** salon with the
 * switch on now has a queue the server will serve — and a plan term here would hide a
 * surface the server is willing to serve. The old test asserted the opposite of the first
 * case below; that is what changed.
 *
 * The switched-off case still has no live example by default (`queue_enabled` defaults to
 * true), except that the same migration turned it off for every salon already on Basic —
 * precisely so ten real salons would not start advertising a line nobody was serving.
 */
describe("runsQueue", () => {
  it("is true whenever the owner has switched it on, on any plan", () => {
    expect(runsQueue({ queueEnabled: true })).toBe(true);
  });

  it("is false when the owner has switched it off", () => {
    expect(runsQueue({ queueEnabled: false })).toBe(false);
  });
});

/*
  These two decide whether the owner console tells somebody their salon is invisible, so the
  cases that matter are the ones where the two conditions disagree. A salon is created
  `pending` by `create_business` and `businesses_select`'s public arm requires `approved`, so
  "approved" and "visible" are genuinely different questions.
*/
describe("isListed", () => {
  it("is true only when the salon is both approved and switched on", () => {
    expect(isListed({ status: "approved", isActive: true })).toBe(true);
  });

  it("is false while it is waiting on review, however the switch is set", () => {
    expect(isListed({ status: "pending", isActive: true })).toBe(false);
    expect(isListed({ status: "pending", isActive: false })).toBe(false);
  });

  it("is false for a rejected or suspended salon", () => {
    expect(isListed({ status: "rejected", isActive: true })).toBe(false);
    expect(isListed({ status: "suspended", isActive: true })).toBe(false);
  });

  /*
    The case the notice's `default` branch exists for: reviewed and approved, but an operator
    switched it off. The owner cannot undo that in Settings, so it has to be told apart from
    "under review" — which is why this is not folded into a status check.
  */
  it("is false for an approved salon an operator switched off", () => {
    expect(isListed({ status: "approved", isActive: false })).toBe(false);
  });
});

describe("isAwaitingReview", () => {
  it("is true only for pending", () => {
    expect(isAwaitingReview({ status: "pending" })).toBe(true);
    for (const status of ["approved", "rejected", "suspended"] as const) {
      expect(isAwaitingReview({ status })).toBe(false);
    }
  });
});

/**
 * The markdown pair. Both exist because the two sources of truth about a discount disagree
 * in one direction: the `product_cards` view computes `discount_pct`, and a plain-table read
 * has no such column — so a null there must never be read as "not discounted".
 */
describe("isDiscounted", () => {
  it("is true only when the was-price is strictly higher", () => {
    expect(isDiscounted({ priceNu: 400, compareAtNu: 500 })).toBe(true);
    expect(isDiscounted({ priceNu: 400, compareAtNu: 400 })).toBe(false);
    expect(isDiscounted({ priceNu: 400, compareAtNu: 300 })).toBe(false);
  });

  /*
    The stale-field case, and the reason the predicate is `>` rather than `!= null`. An owner
    who set a compare-at once and then cut the list price to match is not running an offer,
    and a "−0%" flag on that card would be an advertisement for nothing.
  */
  it("is false when there is no was-price at all", () => {
    expect(isDiscounted({ priceNu: 400, compareAtNu: null })).toBe(false);
  });
});

describe("discountPercent", () => {
  it("prefers the view's own figure, so the badge cannot disagree with the onSale filter", () => {
    // `onSale` is a server-side `discount_pct > 0`; if this recomputed instead, a rounding
    // difference would let a product into the Deals shelf wearing a different number.
    expect(discountPercent({ priceNu: 400, compareAtNu: 500, discountPct: 20 })).toBe(20);
  });

  it("computes it on a plain-table read, where the view's column is absent", () => {
    expect(discountPercent({ priceNu: 400, compareAtNu: 500, discountPct: null })).toBe(20);
  });

  it("rounds to a whole percent", () => {
    // 100/699 = 14.306…
    expect(discountPercent({ priceNu: 599, compareAtNu: 699, discountPct: null })).toBe(14);
    // 1/3 = 33.33…
    expect(discountPercent({ priceNu: 200, compareAtNu: 300, discountPct: null })).toBe(33);
  });

  it("is null whenever there is no genuine markdown, whatever the column says", () => {
    expect(discountPercent({ priceNu: 400, compareAtNu: null, discountPct: null })).toBeNull();
    expect(discountPercent({ priceNu: 400, compareAtNu: 400, discountPct: null })).toBeNull();
    // A stale `discount_pct` on a row whose compare-at no longer beats the price loses to
    // the predicate — the badge follows what is true, not what was computed.
    expect(discountPercent({ priceNu: 400, compareAtNu: 350, discountPct: 20 })).toBeNull();
  });
});
