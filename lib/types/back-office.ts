/**
 * The owner back office's models — clients, product orders, loyalty, payroll, tax and
 * subscription requests. Ported from `tho/app/lib/data/{client,loyalty,team}.dart` and the
 * order half of `models.dart`.
 *
 * `Offer` and `Product` are **not** here: they already live in `lib/types/salon.ts` because
 * the customer surfaces needed them first, and the owner reads the same shape with a wider
 * filter. Redeclaring them would be the fastest way to let the two drift.
 */

// ---------------------------------------------------------------- client book ---

/**
 * One row of the salon's client book — a customer rolled up across their visits.
 *
 * **`customerProfileId` is null for a walk-in**, and that null is load-bearing three times
 * over: `client_history` takes a profile id so a walk-in has no history to fetch,
 * `client_notes.customer_profile_id` is `not null` so they can hold no note, and
 * `clientInSegment(..., "walkIns")` is defined as exactly this being null.
 *
 * `groupKey` is the RPC's own grouping expression — a uuid for a registered customer,
 * `walkin:<name>:<phone>` otherwise. It is a React key and nothing more; it is never a route
 * and never sent back to the server.
 */
export type ClientSummary = {
  customerProfileId: string | null;
  displayName: string;
  phone: string | null;
  /** Completed bookings only. A cancelled booking is not a visit. */
  visits: number;
  /** Sum of `total_price` over completed bookings. */
  totalSpend: number;
  lastVisit: Date | null;
  /** The soonest pending/confirmed booking in the future, or null. */
  nextUpcoming: Date | null;
  hasNote: boolean;
  groupKey: string;
};

/** One booking in a client's history, past or future. */
export type ClientHistoryEntry = {
  bookingId: string;
  startTs: Date;
  status: string;
  totalPrice: number;
  /** The booking's services, comma-joined by the RPC. Null when the booking has none. */
  services: string | null;
};

// -------------------------------------------------------------------- orders ---

/**
 * `orders.status`, an enum in Postgres.
 *
 * `new` is the wire value; the Dart calls the case `newOrder` because `new` is a keyword
 * there. TypeScript has no such problem, so the union is the wire value exactly and no
 * translation table is needed in either direction.
 *
 * ## `out_for_delivery` and `delivered` were missing, and an order went invisible
 *
 * `20260814000001_order_status_values.sql` grew the enum by two, and this union did not
 * follow. Nothing broke loudly, which is why it took a diff of the enum to find:
 *
 * - The **owner's inbox** filters `.in("status", segment.statuses)`, and neither new value
 *   was in any of the three segments — so an order the salon sent out for delivery from the
 *   app appeared in **New, Ready and Done alike: nowhere.** A row that exists, is live, and
 *   is in no list is worse than an error.
 * - The **customer's list** renders the raw value through `StatusPill`, which title-cases
 *   it, so a delivery order read **"Out_for_delivery"**.
 *
 * The enum is append-only and both values are terminal-ish, so the fix is to name them and
 * let every table below key off the union rather than off a hand-written list.
 */
export const ORDER_STATUSES = [
  "new",
  "ready",
  "out_for_delivery",
  "delivered",
  "collected",
  "cancelled",
  "declined",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Wire string → status. Anything unrecognised becomes `new`.
 *
 * The same shape as `queueStatusFromWire`, and the same kind of default: an unknown status
 * must not read as **terminal**, because a finished order is one nobody looks at again. A
 * live order mislabelled "New" is at least in a list somebody works through, which is the
 * lesson the two delivery values taught when they were in no list at all.
 *
 * It exists because `toOrder` asserted instead — `str(m.status) as OrderStatus` — so a value
 * the union does not model became an `OrderStatus` the type system then trusted everywhere,
 * and `ORDER_STATUS_LABEL[status]` handed back `undefined`. Casting past the boundary is how
 * the enum and the union went four days out of step without anything failing.
 */
export function orderStatusFromWire(value: string | null | undefined): OrderStatus {
  return ORDER_STATUSES.find((s) => s === value) ?? "new";
}

/**
 * `orders.fulfilment` — how the order leaves the salon.
 *
 * **It decides which statuses are legal**, which is why it is a field rather than a
 * presentation detail: `set_order_status` gates the delivery transitions on the order's own
 * fulfilment, so a pickup order can never reach `out_for_delivery` and a delivery order can
 * never be marked `collected`.
 *
 * **The column is `not null default 'pickup'`**, added that way by
 * `20260814000003_orders_checkout_columns.sql` — so a row placed before that migration is a
 * *pickup* row, not a row with an unknown shape. Measured on the live database 2026-08-18:
 * `is_nullable = NO`, and 0 of 10 orders carry a null. The server's `coalesce(…, 'pickup')` is
 * belt to that braces rather than the load-bearing part, and `orderFulfilment` mirrors it for
 * the one case a client can still produce: a projection that does not select the column.
 */
export type OrderFulfilment = "pickup" | "delivery";

/** A line item, snapshotted at purchase so a later price change can't rewrite history. */
export type OrderItem = {
  id: string;
  productId: string | null;
  nameSnapshot: string;
  priceNuSnapshot: number;
  qty: number;
  lineTotalNu: number;
};

export type Order = {
  id: string;
  businessId: string;
  customerProfileId: string;
  status: OrderStatus;
  /**
   * What the order comes to, and the figure both sides must agree on.
   *
   * **It is not the sum of the lines any more.** Since
   * `20260814000005_place_order_checkout.sql` the server computes
   * `subtotal − discount + delivery fee`, so an order carrying a promo code or a delivery fee
   * has a `total_nu` that no addition of `order_items` reproduces. Rendering the line sum as
   * "Total" was how a discounted order could be shown at a price nobody paid; `subtotalNu`,
   * `discountNu` and `deliveryFeeNu` exist so the breakdown can be shown instead of guessed.
   */
  totalNu: number;
  /*
    The checkout breakdown, and **none of these four is nullable**.
    `20260814000003_orders_checkout_columns.sql` declares the three ints `not null default 0`
    and `fulfilment` `not null default 'pickup'`, then backfills `subtotal_nu` from `total_nu`.

    So "this order predates the breakdown" is not a state the data has: such a row is an exact
    pickup order with no discount and no fee. **Do not reintroduce `| null` here** — it cost
    `OrderLines` a `!= null` guard and then a `!` assertion to get back past its own field.
    AGENTS.md carries the measurement that settled it.
  */
  /** `subtotal − discount + delivery fee = total`. */
  subtotalNu: number;
  /** A promo code, points spent at checkout, or both — a positive magnitude. */
  discountNu: number;
  /** Zero on a pickup order, and zero on a delivery order the salon delivered free. */
  deliveryFeeNu: number;
  /** Which lifecycle the order is on. Read it through `orderFulfilment`. */
  fulfilment: OrderFulfilment;
  /** Delivery only, and the three fields arrive together or not at all. */
  deliveryAddress: string | null;
  deliveryPhone: string | null;
  deliveryNote: string | null;
  note: string | null;
  declineReason: string | null;
  placedAt: Date;
  updatedAt: Date;
  /** Only when the query joins `businesses(name)` — the customer's list needs it. */
  businessName: string | null;
  items: OrderItem[];
};

// ------------------------------------------------------------------- loyalty ---

export type LoyaltyEarnMode = "per_visit" | "per_spend";

/**
 * A salon's loyalty program. **One per salon** — `loyalty_programs`' primary key is
 * `business_id`, with no `id` column, which is why the write is an upsert on that key.
 */
export type LoyaltyProgram = {
  businessId: string;
  isActive: boolean;
  earnMode: LoyaltyEarnMode;
  pointsPerVisit: number;
  nuPerPoint: number;
};

export type LoyaltyRewardType =
  | "percent_discount"
  | "fixed_discount"
  | "free_service"
  | "free_product";

/**
 * One reward on the menu.
 *
 * The four value fields are mutually exclusive and `loyalty_rewards_shape` enforces it as a
 * four-branch CHECK: `percent_discount` needs `percentOff` and no `amountNu`,
 * `fixed_discount` the reverse, and the two free-* types neither. The form switches on
 * `rewardType` and clears the others rather than sending a shape the database refuses.
 */
export type LoyaltyReward = {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  rewardType: LoyaltyRewardType;
  percentOff: number | null;
  amountNu: number | null;
  /** Free text, not a service id — the column is `text` and nothing joins it. */
  serviceRef: string | null;
  productRef: string | null;
  pointCost: number;
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
};

/**
 * A customer's points at one salon.
 *
 * `held` is the total cost of their *pending* redemptions, so `available` is what they can
 * still spend. `adjust_points` refuses an adjustment that would take `balance` — not
 * `available` — below zero.
 */
export type LoyaltyBalance = {
  balance: number;
  held: number;
  available: number;
};

export type LoyaltyRedemptionStatus = "pending" | "confirmed" | "cancelled" | "expired";

/**
 * A reward a customer has asked to spend points on.
 *
 * Everything about the reward is snapshotted, because the owner may edit or archive the
 * reward between the request and the customer walking in with the code.
 */
export type LoyaltyRedemption = {
  id: string;
  businessId: string;
  customerProfileId: string;
  rewardId: string | null;
  nameSnapshot: string;
  typeSnapshot: LoyaltyRewardType;
  pointCost: number;
  /** The short code the customer reads out. `confirm_redemption` upper-cases its input. */
  code: string;
  status: LoyaltyRedemptionStatus;
  requestedAt: Date;
};

// -------------------------------------------------------------- payroll / tax ---

/** One staff member's pay for a date range — a row of `payroll_report`. */
export type PayrollRow = {
  staffMemberId: string;
  displayName: string;
  completedBookings: number;
  serviceRevenue: number;
  commissionPct: number;
  commission: number;
  baseSalaryNu: number;
  totalPay: number;
};

/**
 * A year's estimated tax position — the single row of `tax_estimate`.
 *
 * Presumptive basis: 15% of turnover is assessable, then the 2026 Bhutan PIT bands.
 * `turnover` counts completed bookings **and collected orders**, so the storefront is in it.
 */
export type TaxEstimate = {
  turnover: number;
  assessable: number;
  incomeTax: number;
  /** 0–1, rounded to 4 places server-side. */
  effectiveRate: number;
  gstRequired: boolean;
  gstEstimate: number;
  filingDeadline: Date;
};

// ---------------------------------------------------------------- plan change ---

/**
 * An owner's request to move to a higher tier.
 *
 * **A request can never be withdrawn.** `plan_change_requests` has an INSERT policy and a
 * SELECT policy and nothing else, so the table-wide UPDATE and DELETE grants are dead. Not
 * with an error, either: measured, an owner's `update … set status='cancelled'` **succeeds and
 * affects 0 rows**, because with no policy for the command the rows aren't visible to it. Only
 * an operator moves `status`, through the admin console's service-role client. That is why
 * `/business/plans` lists requests but offers no cancel — a cancel button would report success
 * and do nothing — and why the writer de-duplicates before inserting instead of tidying up
 * after.
 */
export type PlanChangeRequest = {
  id: string;
  businessId: string;
  requestedBy: string;
  /** `growth` or `pro` — the CHECK admits nothing else, `basic` included. */
  requestedPlan: "growth" | "pro";
  note: string | null;
  status: "pending" | "done" | "cancelled";
  createdAt: Date;
};
