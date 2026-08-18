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
    /*
      **This list is wider than `plans_config.dart`'s Growth card, and deliberately.** Upstream
      shipped the shop rework without going back to its own price list, so mirroring it verbatim
      would publish a *smaller* tier than the database actually sells.

      Every clause here is gated at Growth server-side, which is what makes it a price rather than
      a wish: the storefront and its delivery half by `products_select_public` and
      `set_order_status`, discount codes by `upsert_promo_code` / `expire_promo_code`, the recorded
      payment by `record_order_payment`, and "what sells" by `product_analytics`. All of them
      re-derive `businesses.plan` themselves.

      Two have no surface in *this* client yet (`PARITY.md` §5.1) — an owner creates a discount code
      and reads product analytics in the app. That is a gap in the console, not an overstatement of
      the plan: the subscription buys what the database unlocks.
    */
    features: [
      { label: "Everything in Basic" },
      { label: "Unlimited stylists" },
      { label: "Week view" },
      { label: "Automatic reminders" },
      { label: "Full analytics (trends, heatmap, leaderboard, what sells)" },
      { label: "Client book" },
      { label: "Product storefront, for collection or delivery" },
      { label: "Discount codes" },
      { label: "Order payments recorded at the counter" },
      { label: "Loyalty program" },
      { label: "Walk-in queue" },
    ],
  },
  {
    plan: "pro",
    name: "Pro",
    tagline: "Everything, for busy teams.",
    priceLabel: "Nu 1,499/mo",
    /*
      Two lines changed here on 2026-08-18, and both are corrections rather than edits.

      **"Priority placement" is gone**, following `fb9791c` upstream (audit A3-04). It was
      read by no code in either client, so a Pro salon ranked exactly like a Basic one. This
      list is not only the console's paywall: `/for-salons` renders these bullets on an
      indexable page, so the website went on *publishing* the claim for four days after the
      app stopped making it. See the note in `lib/entitlements.ts`.

      **"Deposits & no-show cover" reads "Deposits & payments on a booking"**, which is the
      one place this file deliberately diverges from `plans_config.dart`'s wording. The
      deposit half is real — `record_payment`, Pro-gated, kinds `deposit | balance | full |
      refund`. The no-show half is not built: `businesses.late_fee_amount` defaults to 0, is
      not in the owner-updatable column grant, and is referenced by no function in the
      schema. Nothing charges anybody for a no-show. The app's card still carries the old
      label; `lib/marketing/content.ts` reached this same conclusion for the homepage, and
      the divergence is the same one, applied to the list a crawler reads.

      **Prepaid packs is new** — `Feature.servicePacks`, and the label is the app's own.
    */
    features: [
      { label: "Everything in Growth" },
      { label: "Commissions & payroll" },
      { label: "Deposits & payments on a booking" },
      { label: "Prepaid packs (sell 10 cuts up front)" },
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
    /*
      Same divergence as the Pro card's bullet, for the same reason: the deposit is real and
      the no-show cover is not built. The app's `_paywallCopy` still says "Deposits & no-show
      cover · Take deposits to protect against no-shows" — a paywall is a sentence somebody
      reads while deciding to pay, so it says only what `record_payment` does.
    */
    title: "Deposits & payments",
    blurb: "Record a deposit or a payment against a booking, so the balance is on the receipt.",
  },
  stylePicker: {
    tier: "pro",
    title: "Style selection",
    blurb: "Customers pick the exact cut they want when they book.",
  },
  /* Verbatim from `_paywallCopy`'s `Feature.servicePacks` case. */
  servicePacks: {
    tier: "pro",
    title: "Prepaid packs",
    blurb: "Sell ten cuts up front and lock in the repeat visits.",
  },
};
