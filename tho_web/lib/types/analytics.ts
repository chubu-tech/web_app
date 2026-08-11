/**
 * The owner dashboard's payload — a port of
 * `tho/app/lib/data/analytics_models.dart`.
 *
 * Every field mirrors a key of the `analytics_dashboard` / `analytics_peak_heatmap` RPCs
 * (migration `20260719000001_owner_analytics.sql`). Kept free of any Supabase import so
 * the charts can be rendered from a literal in a test.
 *
 * **jsonb numerics decode loosely**, which is the whole reason the Dart reads every number
 * through `as num`: a utilization of exactly `0` arrives as an int, `0.42` as a double, and
 * a revenue sum as a string when it overflows a JS-safe integer. Everything numeric here is
 * therefore built with `Number(...)` at the mapper boundary and typed `number` above it.
 *
 * **Deltas are computed here, not by the server.** The RPC ships `revenue` and
 * `revenue_prev`; the fraction between them is `deltaPct` in `lib/analytics.ts`, which
 * returns `null` when the previous figure is 0 — a change from nothing is not a percentage.
 */

/** The four headline figures, each with its previous-period counterpart. */
export type KpiSet = {
  revenue: number;
  revenuePrev: number;
  bookings: number;
  bookingsPrev: number;
  avgTicket: number;
  avgTicketPrev: number;
  /** 0–1, not a percentage. */
  utilization: number;
  utilizationPrev: number;
};

/**
 * One bucket of the revenue series — a day, week, month or year depending on
 * granularity — split into app-booked and walk-in revenue.
 */
export type TrendPoint = {
  bucketStart: Date;
  revenue: number;
  bookings: number;
  appRevenue: number;
  walkInRevenue: number;
};

/** New vs returning customers over the period. Walk-ins are excluded server-side. */
export type RetentionSplit = {
  newCustomers: number;
  returningCustomers: number;
};

/** Terminal booking outcomes in the period. */
export type OpsRates = {
  completed: number;
  noShow: number;
  cancelled: number;
};

/**
 * Month-to-date revenue against the owner's goal.
 *
 * `monthlyGoal` is null when they haven't set one — and `businesses.monthly_revenue_goal`
 * stores a goal of 0 as null, which is the quirk 3b's settings form preserves, so "no goal"
 * and "a goal of nothing" are the same state on purpose.
 */
export type GoalProgress = {
  monthlyGoal: number | null;
  monthToDateRevenue: number;
};

/** A leaderboard row. `avgRating` is null until the member has a rated booking. */
export type StaffStat = {
  staffId: string;
  name: string;
  revenue: number;
  bookings: number;
  /** Share of the period's revenue, 0–1. */
  pct: number;
  avgRating: number | null;
};

/** A top-services row. Both figures ship so the table's toggle is a client-side re-sort. */
export type ServiceStat = {
  serviceId: string;
  name: string;
  revenue: number;
  bookings: number;
  pct: number;
};

/**
 * One cell of the peak-hours grid.
 *
 * `dow` is Postgres `extract(dow)` — **0 = Sunday**, the same convention as
 * `business_hours.day_of_week` and `lib/hours.ts`. The RPC calls the count `bookings`; it is
 * `count` here because the grid has no other kind of number in it.
 */
export type HeatCell = {
  dow: number;
  hour: number;
  count: number;
};

/** The whole dashboard, one round trip. */
export type DashboardData = {
  kpis: KpiSet;
  revenue: TrendPoint[];
  retention: RetentionSplit;
  topStaff: StaffStat[];
  topServices: ServiceStat[];
  ops: OpsRates;
  goal: GoalProgress;
};

/**
 * The period selector's values.
 *
 * These four strings are `analytics_dashboard`'s own CHECK — it raises `22023 'invalid
 * granularity'` on anything else — so making them a union means a typo is a type error
 * rather than a runtime rejection.
 */
export type Granularity = "daily" | "weekly" | "monthly" | "annually";

export const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "annually", label: "Yearly" },
];

/** Unknown or absent falls back to `monthly`, the app's default. */
export function granularityFromString(value: string | null | undefined): Granularity {
  return value === "daily" || value === "weekly" || value === "annually" ? value : "monthly";
}
