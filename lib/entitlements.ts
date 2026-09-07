/**
 * Plan tiers and the features they unlock — a port of
 * `tho/app/lib/data/entitlements.dart`.
 *
 * Payment is handled off-app; a salon's tier lives in `businesses.plan` and is
 * flipped by an operator in the admin console.
 *
 * This is the single source of truth every gated surface checks. **Gate on a
 * `Feature`, never on a plan-name string** — that is what stops the cap drifting
 * from the gate. And the server gates independently (e.g.
 * `set_booking_hairstyle` is Pro-only in SQL), so this only decides what to
 * *show*.
 */

export type Plan = "basic" | "growth" | "pro";

export type Feature =
  | "weekView"
  | "unlimitedStylists"
  | "reminders"
  | "fullAnalytics"
  | "clientBook"
  | "productStore"
  | "loyalty"
  | "commissions"
  | "deposits"
  | "stylePicker"
  | "servicePacks"
  | "reminderChannel";

/*
  **There is no `walkInQueue`.**

  The walk-in queue and its QR check-in are available on every plan. Migration
  `20260902000003_queue_for_all_plans.sql` deleted the `plan in ('growth','pro')`
  gate from `join_queue`, `check_in_booking` and `queue_active_line`'s pre-join
  preview branch, so there is nothing left to gate — `businesses.queue_enabled`,
  the owner's own per-salon switch, is the only control.

  Deleted rather than granted everywhere, and deliberately: a `Feature` nobody
  checks is exactly the shape that let `priorityPlacement` go on being sold for a
  thing that did not exist (see the note below). Removing the union member is also
  what makes the compiler enumerate every consumer instead of us guessing at them.

  Note the existing Basic salons ship switched **off** — `queue_enabled` defaults
  to true, so the migration turned it off for them rather than publishing a live
  "join the queue · N ahead" surface at ten real salons whose owners have never
  opened the board. So the owner-facing story is the switch, not a tier.
*/

/** Features introduced AT each tier; higher tiers inherit the lower ones. */
const GROWTH_ADDS: readonly Feature[] = [
  "weekView",
  "unlimitedStylists",
  "reminders",
  "fullAnalytics",
  "clientBook",
  "productStore",
  "loyalty",
];

const PRO_ADDS: readonly Feature[] = [
  "commissions",
  "deposits",
  // Hairstyle selection at booking — Pro only, matching the gate in
  // `set_booking_hairstyle`.
  "stylePicker",
  /*
    Prepaid service packs — "12 cuts for Nu 4,000", sold up front. Pro only, matching the
    gate `create_service_pack` / `update_service_pack` re-derive from `businesses.plan`.

    It ships upstream **with** its implementation — five tables and seven RPCs — which is
    the standard the removal below set.
  */
  "servicePacks",
  /*
    How booking reminders reach a customer (Push / SMS / WhatsApp).

    Pro, which is the tier it was already on. The settings row used to gate on
    `deposits` as a stand-in for "Pro", so a locked tap raised the deposits paywall
    and pitched no-show cover to an owner who had asked about reminders. Same tier,
    its own name — **no salon's entitlements move**.
  */
  "reminderChannel",
];

/*
  **Do not re-add `priorityPlacement` without a plan term in the recommender.**

  It sat here reading nothing — `lib/recommendations.ts` has no plan term and there is no
  ranking code in `supabase/` — so a Pro salon ranked exactly like a Basic one while the Pro
  card sold the opposite. `/for-salons` renders `PLAN_TIERS` bullets on an indexable page, so
  a feature nothing implements is not a stale flag here, it is a published false claim to
  somebody about to pay Nu 1,499 a month off-app with no refund path. AGENTS.md has the rest.
*/

const UNLOCKED: Record<Plan, ReadonlySet<Feature>> = {
  basic: new Set(),
  growth: new Set(GROWTH_ADDS),
  pro: new Set([...GROWTH_ADDS, ...PRO_ADDS]),
};

/** Null, unknown or wrong-case resolves to `basic` — it fails locked. */
export function planFromString(value: string | null | undefined): Plan {
  return value === "growth" || value === "pro" ? value : "basic";
}

export function hasFeature(plan: string | null | undefined, feature: Feature): boolean {
  return UNLOCKED[planFromString(plan)].has(feature);
}

/**
 * Max concurrently-active stylists; `null` means unlimited. Derived from the
 * unlimited-stylists entitlement so the cap cannot drift from the gate.
 */
export function maxActiveStylists(plan: string | null | undefined): number | null {
  return hasFeature(plan, "unlimitedStylists") ? null : 1;
}
