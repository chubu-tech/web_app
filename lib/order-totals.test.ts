import { describe, expect, it } from "vitest";
import {
  orderTotals,
  promoDiscountNu,
  promoRefusalMessage,
  redemptionDiscountNu,
} from "./order-totals";

/**
 * Every case here is written from the deployed `place_order` and `private.promo_discount_nu`,
 * not from the TypeScript. The SQL is normative: where the two disagree the mirror is wrong.
 *
 * The percentage and cap cases were additionally run through `private.promo_discount_nu` on the
 * live database and matched, so these are pinned against the server's own arithmetic rather than
 * against a reading of it.
 */

describe("promoDiscountNu", () => {
  it("takes a whole percentage off", () => {
    expect(promoDiscountNu("percent", 10, 1000)).toBe(100);
    expect(promoDiscountNu("percent", 100, 1000)).toBe(1000);
  });

  /** `floor`, not round: 15% of 1,290 is 193.5 and the customer gets 193 off, not 194. */
  it("floors a fractional percentage rather than rounding it", () => {
    expect(promoDiscountNu("percent", 15, 1290)).toBe(193);
    expect(promoDiscountNu("percent", 33, 100)).toBe(33);
    expect(promoDiscountNu("percent", 1, 199)).toBe(1);
  });

  it("clamps a percentage to 100", () => {
    expect(promoDiscountNu("percent", 250, 800)).toBe(800);
  });

  it("treats a negative percentage as nothing off", () => {
    expect(promoDiscountNu("percent", -10, 800)).toBe(0);
  });

  it("passes a flat amount through", () => {
    expect(promoDiscountNu("amount", 150, 1000)).toBe(150);
  });

  /**
   * **Deliberately uncapped**, and the reason is `orderTotals`: a promo and a reward can stack,
   * so the cap is applied once against their sum. Capping here as well would be a second,
   * different rule that happens to agree in the single-discount case.
   */
  it("does not cap a flat amount at the subtotal", () => {
    expect(promoDiscountNu("amount", 500, 300)).toBe(500);
  });

  it("reads a missing or negative value as nothing off", () => {
    expect(promoDiscountNu("amount", null, 1000)).toBe(0);
    expect(promoDiscountNu("amount", -50, 1000)).toBe(0);
  });

  /** An unrecognised kind behaves as `amount`, which is the SQL's `else` branch. */
  it("falls back to the amount branch for an unknown kind", () => {
    expect(promoDiscountNu("bogus", 75, 1000)).toBe(75);
  });

  it("never returns a discount against a negative subtotal", () => {
    expect(promoDiscountNu("percent", 50, -100)).toBe(0);
  });
});

describe("redemptionDiscountNu", () => {
  it("reads a percentage reward off its snapshot", () => {
    expect(redemptionDiscountNu("percent_discount", { percent_off: 20 }, 1000)).toBe(200);
  });

  it("reads a fixed reward off its snapshot", () => {
    expect(redemptionDiscountNu("fixed_discount", { amount_nu: 250 }, 1000)).toBe(250);
  });

  /** `value_snapshot` is jsonb, so a number can arrive as a string. */
  it("accepts a numeric string in the snapshot", () => {
    expect(redemptionDiscountNu("percent_discount", { percent_off: "20" }, 1000)).toBe(200);
  });

  it("reads a missing key as nothing off rather than as unusable", () => {
    expect(redemptionDiscountNu("fixed_discount", {}, 1000)).toBe(0);
    expect(redemptionDiscountNu("percent_discount", null, 1000)).toBe(0);
  });

  /**
   * The case that matters most on this platform: the only pending redemption today is a
   * `free_service`, and `place_order` refuses it with `P0004`. Null is what keeps it out of the
   * picker, so the customer is never offered their one reward and then told no.
   */
  it("returns null for a reward that cannot be spent on products", () => {
    expect(redemptionDiscountNu("free_service", { service_id: "s1" }, 1000)).toBeNull();
    expect(redemptionDiscountNu(null, null, 1000)).toBeNull();
  });
});

describe("orderTotals", () => {
  it("is the subtotal when nothing applies", () => {
    expect(orderTotals({ subtotalNu: 1200, fulfilment: "pickup" })).toEqual({
      subtotalNu: 1200,
      discountNu: 0,
      deliveryFeeNu: 0,
      totalNu: 1200,
    });
  });

  it("stacks a promo and a reward", () => {
    const out = orderTotals({
      subtotalNu: 1000,
      promoDiscountNu: 100,
      rewardDiscountNu: 200,
      fulfilment: "pickup",
    });
    expect(out.discountNu).toBe(300);
    expect(out.totalNu).toBe(700);
  });

  /** Capped on the **sum**, once — not on each discount separately. */
  it("never discounts past the subtotal, and never goes negative", () => {
    const out = orderTotals({
      subtotalNu: 500,
      promoDiscountNu: 400,
      rewardDiscountNu: 300,
      fulfilment: "pickup",
    });
    expect(out.discountNu).toBe(500);
    expect(out.totalNu).toBe(0);
  });

  it("charges no delivery fee on a pickup order, whatever the salon charges", () => {
    const out = orderTotals({
      subtotalNu: 300,
      fulfilment: "pickup",
      deliveryFeeNu: 120,
      freeDeliveryOverNu: 1000,
    });
    expect(out.deliveryFeeNu).toBe(0);
    expect(out.totalNu).toBe(300);
  });

  it("adds the fee on a delivery order", () => {
    const out = orderTotals({
      subtotalNu: 300,
      fulfilment: "delivery",
      deliveryFeeNu: 120,
    });
    expect(out.deliveryFeeNu).toBe(120);
    expect(out.totalNu).toBe(420);
  });

  it("waives the fee at the salon's threshold", () => {
    const out = orderTotals({
      subtotalNu: 1000,
      fulfilment: "delivery",
      deliveryFeeNu: 120,
      freeDeliveryOverNu: 1000,
    });
    expect(out.deliveryFeeNu).toBe(0);
    expect(out.totalNu).toBe(1000);
  });

  /**
   * The ordering that surprises people, and the one a client is most likely to get wrong: the
   * threshold is tested against **subtotal − discount**, so a code can cost a customer their
   * free delivery. Same order, one Nu 100 code apart.
   */
  it("judges free delivery on what is left after the discount", () => {
    const free = orderTotals({
      subtotalNu: 1000,
      fulfilment: "delivery",
      deliveryFeeNu: 120,
      freeDeliveryOverNu: 1000,
    });
    const discounted = orderTotals({
      subtotalNu: 1000,
      promoDiscountNu: 100,
      fulfilment: "delivery",
      deliveryFeeNu: 120,
      freeDeliveryOverNu: 1000,
    });
    expect(free.deliveryFeeNu).toBe(0);
    expect(discounted.deliveryFeeNu).toBe(120);
    // And the discount does not even pay for the fee it triggers.
    expect(free.totalNu).toBe(1000);
    expect(discounted.totalNu).toBe(1020);
  });

  it("charges nothing for delivery when the salon has no fee set", () => {
    const out = orderTotals({
      subtotalNu: 300,
      fulfilment: "delivery",
      deliveryFeeNu: null,
    });
    expect(out.deliveryFeeNu).toBe(0);
  });

  /** No threshold means no free delivery, however large the order. */
  it("keeps charging when the salon set no threshold", () => {
    const out = orderTotals({
      subtotalNu: 100000,
      fulfilment: "delivery",
      deliveryFeeNu: 120,
      freeDeliveryOverNu: null,
    });
    expect(out.deliveryFeeNu).toBe(120);
  });

  /** A fully discounted delivery order still pays to be delivered. */
  it("still charges delivery on an order discounted to nothing", () => {
    const out = orderTotals({
      subtotalNu: 500,
      promoDiscountNu: 500,
      fulfilment: "delivery",
      deliveryFeeNu: 120,
      freeDeliveryOverNu: 1000,
    });
    expect(out.discountNu).toBe(500);
    expect(out.deliveryFeeNu).toBe(120);
    expect(out.totalNu).toBe(120);
  });

  it("always reconciles: subtotal minus discount plus fee is the total", () => {
    for (const subtotal of [0, 1, 999, 1000, 12345]) {
      for (const promo of [0, 1, 500, 20000]) {
        for (const fulfilment of ["pickup", "delivery"] as const) {
          const t = orderTotals({
            subtotalNu: subtotal,
            promoDiscountNu: promo,
            fulfilment,
            deliveryFeeNu: 120,
            freeDeliveryOverNu: 1000,
          });
          expect(t.totalNu).toBe(t.subtotalNu - t.discountNu + t.deliveryFeeNu);
          expect(t.totalNu).toBeGreaterThanOrEqual(0);
          expect(t.discountNu).toBeLessThanOrEqual(t.subtotalNu);
        }
      }
    }
  });
});

describe("promoRefusalMessage", () => {
  it("says something different for each reason the server gives", () => {
    const reasons = [
      "not_found",
      "inactive",
      "not_started",
      "expired",
      "limit_reached",
      "below_minimum",
    ] as const;
    const said = reasons.map(promoRefusalMessage);
    expect(new Set(said).size).toBe(reasons.length);
  });

  /**
   * The figure is not in hand — `preview_promo` returns the reason and nothing else — so the
   * sentence must not invent one. A stated threshold the server disagrees with is worse than no
   * threshold at all.
   */
  it("does not name a minimum it cannot know", () => {
    expect(promoRefusalMessage("below_minimum")).not.toMatch(/\d/);
  });

  it("falls back rather than showing a bare token from a later migration", () => {
    expect(promoRefusalMessage("something_new")).toBe("That code isn't valid at this salon.");
  });
});
