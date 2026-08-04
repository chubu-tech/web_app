import type { Feature, Plan } from "./entitlements";

/**
 * The three tiers as a price list — a port of
 * `tho/app/lib/business/plans/plans_config.dart`.
 *
 * **This is the only place pricing lives.** Nothing else in the app may hard-code a figure;
 * the paywall sheet and `/business/plans` both read `PLAN_TIERS`, which is why they cannot
 * quote different numbers at the same owner.
 *
 * Prices are the final launch prices, set 2026-08-03 in `bddb23f`: **Nu 399 / 699 / 1,499**
 * per month. **There is no free tier.** Basic is the entry price, not a giveaway, so nothing
 * in this app may describe any plan as free — the upstream file carries the same warning
 * because its own earlier version said "Free".
 *
 * ## Why the web has an upgrade CTA and the app doesn't
 *
 * `bddb23f` deleted the app's "Request upgrade" button, its operator WhatsApp link and
 * `Api.requestUpgrade` outright, citing **App Store Review Guideline 3.1.1** — no button or
 * other call to action steering a customer toward a purchase made outside in-app purchase —
 * and Google Play's payments policy. The app's Plans screen is now a price list with a
 * current-plan badge and nothing else.
 *
 * A website is not distributed through either store and is not bound by either rule.
 * `plan_change_requests` and its owner-insert policy are still in the database with **no
 * writer in either client**, so the request is a gap only a browser can fill — and
 * `/business/plans` fills it. The gate itself never moves: an operator flips
 * `businesses.plan`, and `entitlements.ts` is the only thing that decides what is unlocked.
 */

export type PlanFeatureLine = {
  label: string;
  /** Declared but not yet shipped, so no salon pays for vapor. */
  soon?: boolean;
};

export type PlanTier = {
  plan: Plan;
  name: string;
  tagline: string;
  priceLabel: string;
  /** Growth wears the "MOST POPULAR" ribbon. */
  highlighted?: boolean;
  features: PlanFeatureLine[];
};

/** Ascending — Basic → Growth → Pro. The order is the upgrade path. */
export const PLAN_TIERS: readonly PlanTier[] = [
  {
    plan: "basic",
    name: "Basic",
    tagline: "Get listed and take bookings.",
    priceLabel: "Nu 399/mo",
    features: [
      { label: "Get listed & discoverable" },
      { label: "Online bookings" },
      { label: "Day (agenda) calendar" },
      { label: "List view" },
      { label: "1 stylist" },
      { label: "Profile, photos & reviews" },
      { label: "Today-snapshot numbers" },
    ],
  },
  {
    plan: "growth",
    name: "Growth",
    tagline: "Run your day and grow.",
    priceLabel: "Nu 699/mo",
    highlighted: true,
    features: [
      { label: "Everything in Basic" },
      { label: "Unlimited stylists" },
      { label: "Week view" },
      { label: "Automatic reminders" },
      { label: "Full analytics (trends, heatmap, leaderboard)" },
      { label: "Client book" },
      { label: "Product storefront" },
      { label: "Loyalty program" },
      { label: "Walk-in queue" },
    ],
  },
  {
    plan: "pro",
    name: "Pro",
    tagline: "Everything, for busy teams.",
    priceLabel: "Nu 1,499/mo",
    features: [
      { label: "Everything in Growth" },
      { label: "Priority placement" },
      { label: "Commissions & payroll" },
      { label: "Deposits & no-show cover" },
    ],
  },
] as const;

/** Every `Plan` has a card, so this always resolves. */
export function planTierFor(plan: Plan): PlanTier {
  return PLAN_TIERS.find((t) => t.plan === plan) ?? PLAN_TIERS[0];
}

/** Ascending index, for "is this tier above the one I'm on?". */
export const PLAN_ORDER: readonly Plan[] = ["basic", "growth", "pro"];

export function planRank(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan);
}

/**
 * What a locked feature is and which tier unlocks it — verbatim from `_paywallCopy` in
 * `paywall_sheet.dart`.
 *
 * Only ever `growth` or `pro`, because Basic features are never gated. That is what keeps
 * the recorded `requested_plan` inside `plan_change_requests`' CHECK, which admits those two
 * and refuses `basic`.
 */
export const FEATURE_COPY: Record<Feature, { tier: Plan; title: string; blurb: string }> = {
  weekView: {
    tier: "growth",
    title: "Week view",
    blurb: "See your whole week at a glance and spot your busy days.",
  },
  unlimitedStylists: {
    tier: "growth",
    title: "Unlimited stylists",
    blurb: "Add your whole team — Basic includes one stylist.",
  },
  reminders: {
    tier: "growth",
    title: "Automatic reminders",
    blurb: "Cut no-shows with automatic booking reminders.",
  },
  fullAnalytics: {
    tier: "growth",
    title: "Full analytics",
    blurb: "Revenue trends, a peak-hours heatmap and a staff leaderboard.",
  },
  clientBook: {
    tier: "growth",
    title: "Client book",
    blurb: "Keep a book of your regulars and their visit history.",
  },
  productStore: {
    tier: "growth",
    title: "Product storefront",
    blurb: "Sell products for cash pickup from your salon page.",
  },
  loyalty: {
    tier: "growth",
    title: "Loyalty program",
    blurb: "Reward repeat customers with points they redeem for perks.",
  },
  walkInQueue: {
    tier: "growth",
    title: "Walk-in queue",
    blurb: "Let walk-ins join a live line and check in bookings ahead of it.",
  },
  commissions: {
    tier: "pro",
    title: "Commissions & payroll",
    blurb: "Track staff commissions and run payroll.",
  },
  deposits: {
    tier: "pro",
    title: "Deposits & no-show cover",
    blurb: "Take deposits to protect against no-shows.",
  },
  priorityPlacement: {
    tier: "pro",
    title: "Priority placement",
    blurb: "Rank higher in customer search results.",
  },
  stylePicker: {
    tier: "pro",
    title: "Style selection",
    blurb: "Customers pick the exact cut they want when they book.",
  },
};
