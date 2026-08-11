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
 */
export type OrderStatus = "new" | "ready" | "collected" | "cancelled" | "declined";

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
  totalNu: number;
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
