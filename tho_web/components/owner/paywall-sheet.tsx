"use client";

import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import type { Feature, Plan } from "@/lib/entitlements";

/**
 * What a locked feature is, and which tier it belongs to — a port of
 * `tho/app/lib/business/plans/paywall_sheet.dart`.
 *
 * **Informational only, and that is upstream's shape, not laziness.** The app's version
 * carried a "Request upgrade" button, a note field and a deep link to the operator's
 * WhatsApp; all three were removed in the commit that set final pricing, citing App Store
 * Review Guideline 3.1.1 — no in-app call to action toward a purchase made outside the
 * store. What is left says what the feature is, names the tier, and stops.
 *
 * **A website is not bound by that rule, and 3c puts the request back.** The
 * `plan_change_requests` table and its owner-insert policy are still in the database with
 * no writer, which is exactly the gap a web console can fill. It lands with
 * `/business/plans` in 3c — where the tiers are listed side by side and a request has
 * context — rather than here, so that until then this sheet is honest about being an
 * explanation and nothing more.
 *
 * Prices are the final ones set 2026-08-03 (`plans_config.dart`). **There is no free
 * tier** — Basic is the entry price, so nothing here may describe any plan as free.
 */

const PRICE: Record<Plan, string> = {
  basic: "Nu 399/mo",
  growth: "Nu 699/mo",
  pro: "Nu 1,499/mo",
};

const PLAN_NAME: Record<Plan, string> = {
  basic: "Basic",
  growth: "Growth",
  pro: "Pro",
};

/** Verbatim from `_paywallCopy` in `paywall_sheet.dart`. */
const COPY: Record<Feature, { tier: Plan; title: string; blurb: string }> = {
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

export function PaywallSheet({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature: Feature;
}) {
  const { tier, title, blurb } = COPY[feature];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button fullWidth onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="gap-base flex flex-col">
        <Icons.unlocked
          className="text-rausch"
          style={{ width: IconSize.lg, height: IconSize.lg }}
          aria-hidden
        />
        <p className="text-body-md text-muted">{blurb}</p>

        <div className="bg-surface-soft p-base gap-sm flex items-center rounded-sm">
          <span className="text-title text-ink flex-1 font-medium">{PLAN_NAME[tier]}</span>
          <span className="text-title text-ink font-medium tabular-nums">{PRICE[tier]}</span>
        </div>

        <p className="text-body-sm text-muted">Part of the {PLAN_NAME[tier]} plan.</p>
      </div>
    </Sheet>
  );
}
