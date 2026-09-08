/**
 * The pure rules behind loyalty — a port of `tho/app/lib/data/loyalty.dart`.
 *
 * No React, no Supabase. Everything here is display over what the ledger already holds:
 * `loyalty_transactions` is append-only and its own migration calls it *"the source of truth +
 * audit trail"*, so a stamp card, a streak and a history are three readings of one set of rows
 * rather than three things to store.
 *
 * **Split out of `analytics.ts`, which says of itself that it holds "the pure rules behind the
 * owner back office".** Half of what follows is customer-facing — a stamp card and a streak are
 * things a customer sees and an owner never does — so the four helpers that were already there
 * (`loyaltyPointsForBooking`, `earnSentence`, `rewardValueLabel`, `progressToNext`) moved here
 * rather than the new ones joining them in a file whose docblock would then be wrong. Same
 * functions, same tests, one import path.
 */

import type {
  LoyaltyProgram,
  LoyaltyRedemption,
  LoyaltyReward,
  LoyaltyTransaction,
} from "./types/back-office";

// ================================================================== earning ===

/** Points a completed booking of `total` Nu would earn — mirrors the earn trigger. */
export function loyaltyPointsForBooking(program: LoyaltyProgram, total: number): number {
  if (program.earnMode === "per_spend") {
    return program.nuPerPoint <= 0 ? 0 : Math.floor(total / program.nuPerPoint);
  }
  return program.pointsPerVisit;
}

/** The customer-facing description of the earn rule, and the owner form's live preview. */
export function earnSentence(program: LoyaltyProgram): string {
  return program.earnMode === "per_spend"
    ? `Customers earn 1 point per Nu ${program.nuPerPoint} spent.`
    : `Customers earn ${program.pointsPerVisit} points every visit.`;
}

/** Short human label for a reward's value — "10% off", "Nu 100 off", "Free: Haircut". */
export function rewardValueLabel(
  r: Pick<
    LoyaltyReward,
    "rewardType" | "percentOff" | "amountNu" | "serviceRef" | "productRef" | "name"
  >,
): string {
  switch (r.rewardType) {
    case "percent_discount":
      return `${r.percentOff ?? 0}% off`;
    case "fixed_discount":
      return `Nu ${r.amountNu ?? 0} off`;
    case "free_service":
      return r.serviceRef ? `Free: ${r.serviceRef}` : "Free service";
    case "free_product":
      return r.productRef ? `Free: ${r.productRef}` : "Free goodie";
    default:
      return r.name;
  }
}

// ================================================================== targets ===

/** The live rewards, cheapest first. Paused and archived rewards are not goals. */
function liveRewards(rewards: LoyaltyReward[]): LoyaltyReward[] {
  return rewards
    .filter((r) => r.isActive && !r.isArchived)
    .sort((a, b) => a.pointCost - b.pointCost);
}

/**
 * The cheapest live reward on a salon's menu, **affordable or not**.
 *
 * The stamp card's target, and deliberately not `progressToNext`'s — see `stampShapeFor` for
 * why the difference is the whole correctness of the card.
 */
export function cheapestLiveReward(rewards: LoyaltyReward[]): LoyaltyReward | null {
  return liveRewards(rewards)[0] ?? null;
}

/**
 * The cheapest reward a customer cannot yet afford, and how far along they are.
 *
 * All affordable → `(null, 1)`; an empty menu → `(null, 0)`. Archived and paused rewards are
 * excluded, because a goal nobody can redeem is not a goal.
 */
export function progressToNext(
  rewards: LoyaltyReward[],
  available: number,
): { target: LoyaltyReward | null; progress: number } {
  const live = liveRewards(rewards);
  if (live.length === 0) return { target: null, progress: 0 };
  for (const r of live) {
    if (r.pointCost > available) {
      return { target: r, progress: Math.min(Math.max(available / r.pointCost, 0), 1) };
    }
  }
  return { target: null, progress: 1 };
}

// =============================================================== stamp card ===

/**
 * The most stamps a card may draw.
 *
 * A row of stamps only beats a number because the gap is countable at a glance; past about a
 * dozen it stops being countable and the number is the better format again.
 */
export const MAX_STAMPS = 12;

/**
 * The fewest stamps a card may draw. One stamp is not a card — it is a yes or no, and the ring
 * already says that better.
 */
export const MIN_STAMPS = 2;

/** Why a programme cannot be drawn as a card. Each maps to one sentence for the owner. */
export type StampRingReason =
  | "perSpend"
  | "visitWorthNothing"
  | "noReward"
  | "notWholeVisits"
  | "tooShort"
  | "tooLong";

/**
 * Whether a salon's programme can be drawn as a stamp card at all, and what shape it takes.
 *
 * Separated from `stampCardFor` because the two callers know different things: the customer's
 * card knows the balance and wants `filled`; the owner's settings screen knows neither and wants
 * to be told *"a 5-stamp card"*, or why not. Without that line the card is invisible to the only
 * person who can bring one about, and most salons would never accidentally land on a clean
 * multiple.
 */
export type StampShape =
  | { kind: "card"; total: number; reward: LoyaltyReward }
  | { kind: "ring"; reason: StampRingReason; reward: LoyaltyReward | null };

export function stampShapeFor(program: LoyaltyProgram, rewards: LoyaltyReward[]): StampShape {
  if (program.earnMode !== "per_visit") return { kind: "ring", reason: "perSpend", reward: null };
  const perVisit = program.pointsPerVisit;
  if (perVisit <= 0) return { kind: "ring", reason: "visitWorthNothing", reward: null };

  /*
    NOT `progressToNext`. That returns the cheapest reward the customer cannot YET afford, which
    quietly makes a full card impossible: its target always costs more than the balance, so
    `filled` can never reach `total`. The card would fill to four of five and then, on the fifth
    visit, silently become a different and longer card — the progress bar that lies, which this
    whole format exists to avoid.

    A punch card's target is the reward it is FOR. It fills, it completes, and it is claimed. So
    the target is the cheapest live reward outright, whether or not the customer can already
    afford it, and the ring keeps `progressToNext` for the cases the card cannot express.
  */
  const reward = cheapestLiveReward(rewards);
  if (reward == null) return { kind: "ring", reason: "noReward", reward: null };

  /*
    The rule that keeps the card honest. A 45-point reward where a visit earns 10 is not "four
    and a half stamps": a card cannot show half a stamp, and rounding it would be a progress bar
    that lies. An inexact programme gets the ring, which can state any fraction truthfully.
  */
  if (reward.pointCost % perVisit !== 0) {
    return { kind: "ring", reason: "notWholeVisits", reward };
  }

  const total = reward.pointCost / perVisit;
  if (total < MIN_STAMPS) return { kind: "ring", reason: "tooShort", reward };
  if (total > MAX_STAMPS) return { kind: "ring", reason: "tooLong", reward };
  return { kind: "card", total, reward };
}

/**
 * The salon's programme drawn as a stamp card, or `null` where it cannot be drawn as one
 * honestly — see `stampShapeFor` for the six refusals.
 *
 * Presentation over the points already in the ledger: a `per_visit` programme where a visit is
 * worth 10 points and the cheapest reward costs 50 *is* a five-stamp card, and always has been.
 * Nothing new is stored, no salon has to opt in, and every case this refuses falls back to the
 * points ring that was there before.
 *
 * **`available` rather than `balance`, and there is a live case behind it:** a customer with 50
 * points, all of them held by a claim already waiting at the counter, has committed them as far
 * as this card is concerned. The card reads 0 of 5, and the held-points row on the detail page
 * is what explains the number.
 */
export function stampCardFor({
  program,
  rewards,
  available,
}: {
  program: LoyaltyProgram;
  rewards: LoyaltyReward[];
  available: number;
}): { filled: number; total: number; reward: LoyaltyReward } | null {
  const shape = stampShapeFor(program, rewards);
  if (shape.kind !== "card") return null;
  // Floored, because a partial stamp is exactly what this format cannot say; clamped, because a
  // balance is read separately from the reward menu and a stamp shown as more than filled would
  // be the same lie in the other direction.
  const banked = Math.floor(available / program.pointsPerVisit);
  return {
    filled: Math.min(Math.max(banked, 0), shape.total),
    total: shape.total,
    reward: shape.reward,
  };
}

/**
 * What the owner's current numbers produce, in one sentence — and where they produce a ring,
 * the nearest reward prices that would produce a card instead.
 *
 * The suggestion is the half that makes it actionable. *"Not a whole number of visits"* tells an
 * owner their programme is wrong without telling them what right looks like, and the fix is
 * arithmetic nobody should have to do at a settings screen.
 */
export function stampCardExplanation(
  program: LoyaltyProgram,
  rewards: LoyaltyReward[],
): { isCard: boolean; text: string } {
  const shape = stampShapeFor(program, rewards);
  if (shape.kind === "card") {
    return {
      isCard: true,
      text: `Customers see a ${shape.total}-stamp card toward ${shape.reward.name}.`,
    };
  }

  const ring = "Customers see a points ring instead of a stamp card";
  const cost = shape.reward?.pointCost ?? 0;
  const fix = nearestCardPrices(program.pointsPerVisit, cost);
  const withFix = (why: string) => ({ isCard: false, text: fix ? `${why} ${fix}` : why });

  switch (shape.reason) {
    case "perSpend":
      return { isCard: false, text: `${ring} — a card needs points per visit, not per spend.` };
    case "visitWorthNothing":
      return { isCard: false, text: `${ring} — a visit has to be worth at least 1 point.` };
    case "noReward":
      return { isCard: false, text: `${ring}. Add a reward for them to collect toward.` };
    case "tooShort":
      return withFix(
        `${ring} — ${shape.reward?.name ?? "your cheapest reward"} costs a single visit, which is a yes or no rather than a card.`,
      );
    case "tooLong":
      return withFix(
        `${ring} — that would run to more than ${MAX_STAMPS} stamps, which stops being countable at a glance.`,
      );
    default:
      return withFix(
        `${ring} — ${cost} points is not a whole number of ${program.pointsPerVisit}-point visits.`,
      );
  }
}

/**
 * "Price it at 40, 50 or 60 points — that is 4, 5 or 6 stamps." Null when nothing lands.
 *
 * The stamp count is clamped into the legal range **before** its neighbours are taken, so a
 * reward priced at twenty visits is answered with the ceiling rather than with three more
 * numbers that are all still too long. Phrased as a second clause rather than "a {n}-stamp
 * card" to sidestep a/an: the range runs through 8 and 11.
 */
function nearestCardPrices(perVisit: number, pointCost: number): string | null {
  if (perVisit <= 0 || pointCost <= 0) return null;
  const wanted = Math.min(Math.max(Math.round(pointCost / perVisit), MIN_STAMPS), MAX_STAMPS);
  const counts = [wanted - 1, wanted, wanted + 1].filter(
    (n) => n >= MIN_STAMPS && n <= MAX_STAMPS && n * perVisit !== pointCost,
  );
  if (counts.length === 0) return null;
  const list = (xs: number[]) =>
    xs.length === 1 ? `${xs[0]}` : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`;
  return `Price it at ${list(counts.map((n) => n * perVisit))} points — that is ${list(counts)} stamps.`;
}

// =================================================================== streak ===

/**
 * How long a customer may leave it between visits before their run is broken.
 *
 * One constant for every salon, deliberately: a streak whose rules varied per salon could not be
 * explained to a customer in one sentence, which is the only thing that makes a streak worth
 * showing. 45 days, because a haircut cadence runs three to six weeks — 45 clears six weeks with
 * slack, so someone keeping their normal rhythm never breaks a run by accident, while someone
 * who has drifted away for two months genuinely has.
 */
export const STREAK_WINDOW_DAYS = 45;

const STREAK_WINDOW_MS = STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * The customer's current run of visits at one salon, and the date the next visit has to happen
 * by for it to survive — or `null` where there is no run to show.
 *
 * Counts only `earn` entries: a redemption is spending rather than visiting, and an adjustment
 * is the owner correcting the books. Walks the earns newest-first and stops at the first gap
 * wider than the window, so the run is the tail of the ledger rather than its whole length. Two
 * earns on the same day sit zero apart, which is inside the window, so a second visit in a day
 * never breaks a run.
 *
 * `now` is a parameter rather than a clock read — the same reason `clientInSegment` takes one —
 * so the boundary is testable to the day.
 *
 * Returns `null` when there are no earns at all, **and when the most recent earn is already
 * older than the window**: a lapsed run beside a deadline in the past is advertising a failure.
 */
export function streakFrom(
  txns: LoyaltyTransaction[],
  now: Date,
): { length: number; keepBy: Date } | null {
  const earnedAt = txns
    .filter((t) => t.kind === "earn")
    .map((t) => t.createdAt.getTime())
    .sort((a, b) => b - a);
  if (earnedAt.length === 0) return null;

  const last = earnedAt[0]!;
  if (now.getTime() - last > STREAK_WINDOW_MS) return null;

  let length = 1;
  for (let i = 1; i < earnedAt.length; i++) {
    if (earnedAt[i - 1]! - earnedAt[i]! > STREAK_WINDOW_MS) break;
    length++;
  }
  return { length, keepBy: new Date(last + STREAK_WINDOW_MS) };
}

// ================================================================= timeline ===

/**
 * One entry in the customer's loyalty history: either a redemption, which carries the reward's
 * name, or a bare ledger movement.
 */
export type LoyaltyEvent =
  | { kind: "redemption"; at: Date; redemption: LoyaltyRedemption }
  | { kind: "transaction"; at: Date; transaction: LoyaltyTransaction };

/** Still waiting to be shown at the counter, and still holding its points. */
export function isPendingEvent(e: LoyaltyEvent): boolean {
  return e.kind === "redemption" && e.redemption.status === "pending";
}

/**
 * The customer's loyalty history at one salon as a single timeline, newest first.
 *
 * **The two sources overlap by design**: confirming a redemption writes a `redeem` transaction
 * carrying that redemption's id. Showing both would report one event twice, so a transaction is
 * dropped wherever a redemption already covers it — and **the redemption is the one kept,
 * because it carries the reward's name where the transaction carries only a number.**
 *
 * Pending and cancelled redemptions have no transaction behind them at all and stand alone.
 * Earns and manual adjustments have no redemption and likewise stand alone.
 *
 * Pure over its inputs, with no clock read, so the ordering and the de-duplication are directly
 * testable.
 */
export function mergeLoyaltyTimeline({
  txns,
  redemptions,
}: {
  txns: LoyaltyTransaction[];
  redemptions: LoyaltyRedemption[];
}): LoyaltyEvent[] {
  const covered = new Set(redemptions.map((r) => r.id));
  const events: LoyaltyEvent[] = [
    ...redemptions.map(
      (r): LoyaltyEvent => ({ kind: "redemption", at: r.requestedAt, redemption: r }),
    ),
    ...txns
      .filter((t) => t.redemptionId == null || !covered.has(t.redemptionId))
      .map((t): LoyaltyEvent => ({ kind: "transaction", at: t.createdAt, transaction: t })),
  ];
  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events;
}
