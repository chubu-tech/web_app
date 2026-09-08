import { describe, expect, it } from "vitest";
import {
  cheapestLiveReward,
  earnSentence,
  loyaltyPointsForBooking,
  MAX_STAMPS,
  mergeLoyaltyTimeline,
  progressToNext,
  rewardValueLabel,
  stampCardExplanation,
  stampCardFor,
  streakFrom,
  STREAK_WINDOW_DAYS,
} from "./loyalty";
import type {
  LoyaltyProgram,
  LoyaltyRedemption,
  LoyaltyReward,
  LoyaltyTransaction,
} from "./types/back-office";

const PROGRAM: LoyaltyProgram = {
  businessId: "b1",
  isActive: true,
  earnMode: "per_visit",
  pointsPerVisit: 10,
  nuPerPoint: 10,
};

function reward(over: Partial<LoyaltyReward> = {}): LoyaltyReward {
  return {
    id: "r1",
    businessId: "b1",
    name: "Reward",
    description: null,
    rewardType: "percent_discount",
    percentOff: 10,
    amountNu: null,
    serviceRef: null,
    productRef: null,
    pointCost: 50,
    isActive: true,
    isArchived: false,
    sortOrder: 0,
    ...over,
  };
}

const DAY = 24 * 60 * 60 * 1000;

function txn(over: Partial<LoyaltyTransaction> = {}): LoyaltyTransaction {
  return {
    id: "t1",
    businessId: "b1",
    kind: "earn",
    points: 10,
    bookingId: null,
    redemptionId: null,
    orderId: null,
    reason: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    ...over,
  };
}

function redemption(over: Partial<LoyaltyRedemption> = {}): LoyaltyRedemption {
  return {
    id: "x1",
    businessId: "b1",
    customerProfileId: "c1",
    rewardId: "r1",
    nameSnapshot: "Free haircut",
    typeSnapshot: "free_service",
    pointCost: 50,
    code: "ABC123",
    status: "pending",
    requestedAt: new Date("2026-09-01T10:00:00Z"),
    ...over,
  };
}

// ================================================================== earning ===

describe("loyalty earning", () => {
  it("per visit ignores the ticket entirely", () => {
    expect(loyaltyPointsForBooking(PROGRAM, 0)).toBe(10);
    expect(loyaltyPointsForBooking(PROGRAM, 5000)).toBe(10);
  });

  it("per spend floors, so a part-point is not a point", () => {
    const spend: LoyaltyProgram = { ...PROGRAM, earnMode: "per_spend", nuPerPoint: 100 };
    expect(loyaltyPointsForBooking(spend, 950)).toBe(9);
    expect(loyaltyPointsForBooking(spend, 99)).toBe(0);
  });

  it("never divides by zero even though the CHECK forbids it", () => {
    const broken: LoyaltyProgram = { ...PROGRAM, earnMode: "per_spend", nuPerPoint: 0 };
    expect(loyaltyPointsForBooking(broken, 500)).toBe(0);
  });

  it("describes the rule in the customer's terms", () => {
    expect(earnSentence(PROGRAM)).toBe("Customers earn 10 points every visit.");
    expect(earnSentence({ ...PROGRAM, earnMode: "per_spend", nuPerPoint: 50 })).toBe(
      "Customers earn 1 point per Nu 50 spent.",
    );
  });
});

describe("rewardValueLabel", () => {
  it("labels each of the four shapes", () => {
    expect(rewardValueLabel(reward())).toBe("10% off");
    expect(
      rewardValueLabel(reward({ rewardType: "fixed_discount", percentOff: null, amountNu: 100 })),
    ).toBe("Nu 100 off");
    expect(
      rewardValueLabel(
        reward({ rewardType: "free_service", percentOff: null, serviceRef: "Haircut" }),
      ),
    ).toBe("Free: Haircut");
    expect(rewardValueLabel(reward({ rewardType: "free_product", percentOff: null }))).toBe(
      "Free goodie",
    );
  });
});

// ================================================================== targets ===

describe("progressToNext", () => {
  it("an empty menu has no goal and no progress", () => {
    expect(progressToNext([], 100)).toEqual({ target: null, progress: 0 });
  });

  it("targets the cheapest reward out of reach", () => {
    const out = progressToNext(
      [reward({ id: "cheap", pointCost: 30 }), reward({ id: "dear", pointCost: 80 })],
      50,
    );
    expect(out.target?.id).toBe("dear");
    expect(out.progress).toBeCloseTo(50 / 80, 9);
  });

  it("is complete when everything is affordable", () => {
    expect(progressToNext([reward({ pointCost: 10 })], 50)).toEqual({
      target: null,
      progress: 1,
    });
  });

  it("ignores paused and archived rewards — an unredeemable goal is not a goal", () => {
    const out = progressToNext(
      [
        reward({ id: "paused", pointCost: 30, isActive: false }),
        reward({ id: "gone", pointCost: 40, isArchived: true }),
        reward({ id: "live", pointCost: 90 }),
      ],
      20,
    );
    expect(out.target?.id).toBe("live");
  });
});

describe("cheapestLiveReward", () => {
  /**
   * The distinction the stamp card is built on. `progressToNext` skips what is already
   * affordable; this does not, which is the only reason a card can ever fill.
   */
  it("takes the cheapest reward even when it is already affordable", () => {
    const rewards = [reward({ id: "cheap", pointCost: 30 }), reward({ id: "dear", pointCost: 80 })];
    expect(cheapestLiveReward(rewards)?.id).toBe("cheap");
    expect(progressToNext(rewards, 50).target?.id).toBe("dear");
  });

  it("is null when nothing is live", () => {
    expect(cheapestLiveReward([])).toBeNull();
    expect(cheapestLiveReward([reward({ isActive: false })])).toBeNull();
    expect(cheapestLiveReward([reward({ isArchived: true })])).toBeNull();
  });
});

// =============================================================== stamp card ===

describe("stampCardFor", () => {
  it("draws the live case: 10 points a visit toward a 50-point reward is a five-stamp card", () => {
    const card = stampCardFor({ program: PROGRAM, rewards: [reward()], available: 30 });
    expect(card).toEqual({ filled: 3, total: 5, reward: expect.objectContaining({ id: "r1" }) });
  });

  /**
   * The prohibition the whole format rests on: a card MUST be able to reach completion. Aiming
   * at the cheapest reward the customer cannot yet afford would retarget upward each time the
   * card was about to fill, so `filled` could never reach `total`.
   */
  it("can be completed — the target does not move once it is affordable", () => {
    const rewards = [reward({ id: "cheap", pointCost: 50 }), reward({ id: "dear", pointCost: 90 })];
    expect(stampCardFor({ program: PROGRAM, rewards, available: 40 })).toMatchObject({
      filled: 4,
      total: 5,
    });
    expect(stampCardFor({ program: PROGRAM, rewards, available: 50 })).toMatchObject({
      filled: 5,
      total: 5,
    });
  });

  it("clamps both ways — a partial stamp is unsayable and an over-full card is a lie", () => {
    expect(stampCardFor({ program: PROGRAM, rewards: [reward()], available: 39 })?.filled).toBe(3);
    expect(stampCardFor({ program: PROGRAM, rewards: [reward()], available: 500 })?.filled).toBe(5);
    expect(stampCardFor({ program: PROGRAM, rewards: [reward()], available: -20 })?.filled).toBe(0);
  });

  /**
   * The live case behind reading `available` rather than `balance`: 50 points earned, all 50
   * held by a claim waiting at the counter. The card is empty because the points are committed.
   */
  it("reads points held by a pending claim as spent", () => {
    expect(stampCardFor({ program: PROGRAM, rewards: [reward()], available: 0 })?.filled).toBe(0);
  });

  it("refuses per-spend, a worthless visit, and an empty menu", () => {
    const perSpend: LoyaltyProgram = { ...PROGRAM, earnMode: "per_spend" };
    expect(stampCardFor({ program: perSpend, rewards: [reward()], available: 30 })).toBeNull();
    const free: LoyaltyProgram = { ...PROGRAM, pointsPerVisit: 0 };
    expect(stampCardFor({ program: free, rewards: [reward()], available: 30 })).toBeNull();
    expect(stampCardFor({ program: PROGRAM, rewards: [], available: 30 })).toBeNull();
  });

  it("refuses a cost that is not a whole number of visits", () => {
    const rewards = [reward({ pointCost: 45 })];
    expect(stampCardFor({ program: PROGRAM, rewards, available: 30 })).toBeNull();
  });

  it("refuses a card of one stamp, or of more than twelve", () => {
    expect(
      stampCardFor({ program: PROGRAM, rewards: [reward({ pointCost: 10 })], available: 0 }),
    ).toBeNull();
    expect(
      stampCardFor({ program: PROGRAM, rewards: [reward({ pointCost: 20 })], available: 0 }),
    ).toMatchObject({ total: 2 });
    expect(
      stampCardFor({
        program: PROGRAM,
        rewards: [reward({ pointCost: MAX_STAMPS * 10 })],
        available: 0,
      }),
    ).toMatchObject({ total: MAX_STAMPS });
    expect(
      stampCardFor({
        program: PROGRAM,
        rewards: [reward({ pointCost: (MAX_STAMPS + 1) * 10 })],
        available: 0,
      }),
    ).toBeNull();
  });
});

describe("stampCardExplanation", () => {
  it("names the card the owner's numbers produce", () => {
    expect(stampCardExplanation(PROGRAM, [reward({ name: "Free haircut" })])).toEqual({
      isCard: true,
      text: "Customers see a 5-stamp card toward Free haircut.",
    });
  });

  it("suggests the nearest prices that would make a card", () => {
    const out = stampCardExplanation(PROGRAM, [reward({ pointCost: 45 })]);
    expect(out.isCard).toBe(false);
    expect(out.text).toContain("45 points is not a whole number of 10-point visits");
    expect(out.text).toContain("Price it at 40, 50 or 60 points — that is 4, 5 or 6 stamps.");
  });

  /**
   * Twenty visits is not answered with nineteen, twenty and twenty-one. The count is clamped
   * into the legal range before its neighbours are taken, so the suggestion is the ceiling.
   */
  it("suggests the ceiling when the card would be too long", () => {
    const out = stampCardExplanation(PROGRAM, [reward({ pointCost: 200 })]);
    expect(out.isCard).toBe(false);
    expect(out.text).toContain(`more than ${MAX_STAMPS} stamps`);
    expect(out.text).toContain("Price it at 110 or 120 points — that is 11 or 12 stamps.");
  });

  it("explains per-spend, a worthless visit and an empty menu without a suggestion", () => {
    expect(stampCardExplanation({ ...PROGRAM, earnMode: "per_spend" }, [reward()]).text).toContain(
      "points per visit, not per spend",
    );
    expect(stampCardExplanation({ ...PROGRAM, pointsPerVisit: 0 }, [reward()]).text).toContain(
      "worth at least 1 point",
    );
    expect(stampCardExplanation(PROGRAM, []).text).toContain("Add a reward");
  });

  it("says why a single-visit reward is not a card, and what would make it one", () => {
    const out = stampCardExplanation(PROGRAM, [reward({ name: "Free tea", pointCost: 10 })]);
    expect(out.text).toContain("Free tea costs a single visit");
    expect(out.text).toContain("Price it at 20 or 30 points — that is 2 or 3 stamps.");
  });
});

// =================================================================== streak ===

describe("streakFrom", () => {
  const now = new Date("2026-09-08T12:00:00Z");

  it("has nothing to show without an earn", () => {
    expect(streakFrom([], now)).toBeNull();
    expect(streakFrom([txn({ kind: "redeem", points: -50 })], now)).toBeNull();
    expect(streakFrom([txn({ kind: "adjust", points: 5 })], now)).toBeNull();
  });

  it("counts a run and states the date it has to be kept alive by", () => {
    const out = streakFrom(
      [
        txn({ id: "a", createdAt: new Date(now.getTime() - 5 * DAY) }),
        txn({ id: "b", createdAt: new Date(now.getTime() - 30 * DAY) }),
        txn({ id: "c", createdAt: new Date(now.getTime() - 60 * DAY) }),
      ],
      now,
    );
    expect(out?.length).toBe(3);
    expect(out?.keepBy.getTime()).toBe(now.getTime() - 5 * DAY + STREAK_WINDOW_DAYS * DAY);
  });

  it("stops at the first gap wider than the window", () => {
    const out = streakFrom(
      [
        txn({ id: "a", createdAt: new Date(now.getTime() - 1 * DAY) }),
        txn({ id: "b", createdAt: new Date(now.getTime() - 20 * DAY) }),
        // 46 days before the one above it — the run ends here.
        txn({ id: "c", createdAt: new Date(now.getTime() - 66 * DAY) }),
        txn({ id: "d", createdAt: new Date(now.getTime() - 70 * DAY) }),
      ],
      now,
    );
    expect(out?.length).toBe(2);
  });

  it("counts two visits on one day as two, because zero days apart is inside the window", () => {
    const out = streakFrom(
      [
        txn({ id: "a", createdAt: new Date(now.getTime() - 1 * DAY) }),
        txn({ id: "b", createdAt: new Date(now.getTime() - 1 * DAY) }),
      ],
      now,
    );
    expect(out?.length).toBe(2);
  });

  /** A lapsed run beside a deadline in the past is advertising a failure. */
  it("shows nothing once the most recent visit is older than the window", () => {
    const stale = [txn({ createdAt: new Date(now.getTime() - (STREAK_WINDOW_DAYS + 1) * DAY) })];
    expect(streakFrom(stale, now)).toBeNull();
    const justInside = [
      txn({ createdAt: new Date(now.getTime() - STREAK_WINDOW_DAYS * DAY) }),
    ];
    expect(streakFrom(justInside, now)?.length).toBe(1);
  });

  it("reads the ledger in whatever order it arrives", () => {
    const out = streakFrom(
      [
        txn({ id: "old", createdAt: new Date(now.getTime() - 30 * DAY) }),
        txn({ id: "new", createdAt: new Date(now.getTime() - 2 * DAY) }),
      ],
      now,
    );
    expect(out?.length).toBe(2);
    expect(out?.keepBy.getTime()).toBe(now.getTime() - 2 * DAY + STREAK_WINDOW_DAYS * DAY);
  });
});

// ================================================================= timeline ===

describe("mergeLoyaltyTimeline", () => {
  it("keeps the redemption over the transaction that settles it — the name beats the number", () => {
    const r = redemption({ id: "x1", status: "confirmed", nameSnapshot: "Free haircut" });
    const settled = txn({ id: "t-redeem", kind: "redeem", points: -50, redemptionId: "x1" });
    const events = mergeLoyaltyTimeline({ txns: [settled], redemptions: [r] });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "redemption" });
  });

  it("keeps a redeem transaction whose redemption is not in the list", () => {
    const orphan = txn({ id: "t-redeem", kind: "redeem", points: -50, redemptionId: "gone" });
    const events = mergeLoyaltyTimeline({ txns: [orphan], redemptions: [] });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "transaction" });
  });

  it("stands pending and cancelled redemptions alone — they have no transaction behind them", () => {
    const events = mergeLoyaltyTimeline({
      txns: [],
      redemptions: [
        redemption({ id: "p", status: "pending" }),
        redemption({ id: "c", status: "cancelled" }),
      ],
    });
    expect(events).toHaveLength(2);
  });

  it("orders newest first across both sources", () => {
    const events = mergeLoyaltyTimeline({
      txns: [
        txn({ id: "t-old", createdAt: new Date("2026-08-01T00:00:00Z") }),
        txn({ id: "t-new", createdAt: new Date("2026-09-05T00:00:00Z") }),
      ],
      redemptions: [redemption({ id: "r-mid", requestedAt: new Date("2026-09-01T00:00:00Z") })],
    });
    expect(
      events.map((e) => (e.kind === "transaction" ? e.transaction.id : e.redemption.id)),
    ).toEqual(["t-new", "r-mid", "t-old"]);
  });

  it("is empty for an empty ledger", () => {
    expect(mergeLoyaltyTimeline({ txns: [], redemptions: [] })).toEqual([]);
  });
});
