import { describe, expect, it } from "vitest";
import { hasFeature, maxActiveStylists, planFromString, type Feature } from "./entitlements";
import { FEATURE_COPY, PLAN_ORDER, PLAN_TIERS, planRank, planTierFor } from "./plans";

/**
 * The tier split, pinned — a port of the assertions implicit in
 * `../tho/app/lib/data/entitlements.dart`.
 *
 * **This file exists because of a drift that nothing caught for four days.** Upstream deleted
 * `Feature.priorityPlacement` in `fb9791c` as a claim with no implementation behind it, and added
 * `Feature.servicePacks` when packs shipped. `tho_web` mirrored neither — so the console's paywall
 * and, worse, the indexable `/for-salons` page went on **selling "Priority placement"** to salon
 * owners after the app had stopped, and Pro's real new perk was sold nowhere.
 *
 * A build, a lint and 639 passing tests all stayed green through that, because nothing asserted
 * what the sets *contain*. The three tests below do, in the two directions that matter: every
 * feature is unlocked at the right tier, and **no feature exists that the app does not have.** The
 * second half is the one that would have failed.
 */

/** Every `Feature` in the union — the compiler checks this is exhaustive via `FEATURE_COPY`. */
const ALL_FEATURES = Object.keys(FEATURE_COPY) as Feature[];

const GROWTH: Feature[] = [
  "weekView",
  "unlimitedStylists",
  "reminders",
  "fullAnalytics",
  "clientBook",
  "productStore",
  "loyalty",
  "walkInQueue",
];

const PRO_ONLY: Feature[] = ["commissions", "deposits", "stylePicker", "servicePacks"];

describe("the tier split mirrors entitlements.dart", () => {
  it("unlocks nothing at Basic — it is the entry price, not a free tier", () => {
    for (const feature of ALL_FEATURES) {
      expect(hasFeature("basic", feature)).toBe(false);
    }
  });

  it("unlocks the eight _growthAdds at Growth, and no Pro perk", () => {
    for (const feature of GROWTH) expect(hasFeature("growth", feature)).toBe(true);
    for (const feature of PRO_ONLY) expect(hasFeature("growth", feature)).toBe(false);
  });

  it("inherits Growth at Pro and adds the four _proAdds", () => {
    for (const feature of [...GROWTH, ...PRO_ONLY]) {
      expect(hasFeature("pro", feature)).toBe(true);
    }
  });

  /*
    The direction that catches the next `priorityPlacement`. `GROWTH` and `PRO_ONLY` are written out
    from the Dart by hand, so a feature added here and forgotten there — or invented here and never
    upstream — leaves the union larger than the two lists and fails.
  */
  it("has no feature the app does not have", () => {
    expect([...ALL_FEATURES].sort()).toEqual([...GROWTH, ...PRO_ONLY].sort());
    expect(ALL_FEATURES).not.toContain("priorityPlacement");
  });

  it("fails locked on a null, unknown or wrong-case plan", () => {
    expect(planFromString(null)).toBe("basic");
    expect(planFromString("Pro")).toBe("basic");
    expect(planFromString("enterprise")).toBe("basic");
    expect(hasFeature(undefined, "walkInQueue")).toBe(false);
  });

  it("derives the stylist cap from the entitlement rather than repeating it", () => {
    expect(maxActiveStylists("basic")).toBe(1);
    expect(maxActiveStylists("growth")).toBeNull();
    expect(maxActiveStylists("pro")).toBeNull();
  });
});

describe("the price list", () => {
  it("carries the final launch prices, with no free tier", () => {
    expect(PLAN_TIERS.map((t) => t.priceLabel)).toEqual([
      "Nu 399/mo",
      "Nu 699/mo",
      "Nu 1,499/mo",
    ]);
    for (const tier of PLAN_TIERS) {
      expect(tier.priceLabel.toLowerCase()).not.toContain("free");
    }
  });

  it("sells no feature the app removed, and does sell the one it added", () => {
    const labels = PLAN_TIERS.flatMap((t) => t.features.map((f) => f.label.toLowerCase()));
    // A3-04: read by no code in either client, so it must appear on no card and no page.
    expect(labels.some((l) => l.includes("priority placement"))).toBe(false);
    // `businesses.late_fee_amount` is referenced by no function in the schema.
    expect(labels.some((l) => l.includes("no-show cover"))).toBe(false);
    expect(labels.some((l) => l.includes("prepaid packs"))).toBe(true);
  });

  it("resolves a card and a rank for every plan", () => {
    expect(planTierFor("pro").name).toBe("Pro");
    expect(planRank("basic")).toBeLessThan(planRank("growth"));
    expect(planRank("growth")).toBeLessThan(planRank("pro"));
  });

  /*
    `plan_change_requests`' CHECK admits `growth` and `pro` and refuses `basic`, and the paywall's
    recorded `requested_plan` comes from this table — so a Basic-tier entry here would produce a
    request the database rejects.
  */
  it("never points a paywall at Basic", () => {
    for (const feature of ALL_FEATURES) {
      expect(["growth", "pro"]).toContain(FEATURE_COPY[feature].tier);
    }
  });

  /*
    Which tier a feature belongs to is written down **twice** — in `GROWTH_ADDS`/`PRO_ADDS`,
    which is the gate, and in `FEATURE_COPY[f].tier`, which is the sentence somebody reads while
    deciding to pay. Until this test nothing checked they agreed, so a feature gated at Pro could
    be advertised as Growth on `/for-salons` — an indexable page quoting a price. That is the
    same class of failure as `priorityPlacement`, which is what this whole file exists to close;
    it just needed the other half of the claim pinned too.

    Lowest, not merely sufficient: a paywall naming Pro for something Growth already unlocks
    sells an upgrade nobody needs to buy.
  */
  it("advertises each feature at the lowest tier that actually unlocks it", () => {
    for (const feature of ALL_FEATURES) {
      const advertised = FEATURE_COPY[feature].tier;
      expect(hasFeature(advertised, feature)).toBe(true);
      for (const plan of PLAN_ORDER) {
        if (planRank(plan) < planRank(advertised)) {
          expect(hasFeature(plan, feature)).toBe(false);
        }
      }
    }
  });
});
