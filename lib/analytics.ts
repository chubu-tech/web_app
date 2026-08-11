import type {
  DashboardData,
  GoalProgress,
  HeatCell,
  OpsRates,
  RetentionSplit,
} from "./types/analytics";
import type {
  ClientSummary,
  LoyaltyProgram,
  LoyaltyReward,
  OrderStatus,
} from "./types/back-office";
import { thimphuToday } from "./time";
import type { Offer } from "./types/salon";
import { formatNu } from "./utils";

/**
 * The pure rules behind the owner back office — a port of
 * `tho/app/lib/business/insights/dashboard_logic.dart`,
 * `business/clients/client_book_logic.dart`, `data/team.dart`'s tax bands and the order
 * half of `data/models.dart`.
 *
 * No React, no Supabase, no copy that isn't a rule. Tested in `lib/analytics.test.ts`
 * against the same cases as `dashboard_logic_test.dart` and `client_book_logic_test.dart`,
 * so if a rule changes on either platform both suites should change together.
 */

// ============================================================ revenue pacing ===

/**
 * Month-to-date revenue projected to month end, against the owner's goal.
 *
 * The dashboard already showed "62% of goal" — true, but not useful. On the 8th, 62% is
 * extraordinary; on the 28th it is alarming. Pacing answers the question the percentage
 * can't: *at this rate, where do I land?*
 */
export type RevenuePace = {
  monthToDate: number;
  goal: number | null;
  /** 1-based, and the number of days that have contributed to `monthToDate`. */
  dayOfMonth: number;
  daysInMonth: number;
  /** Days still to trade, **today excluded** — today is already partly banked. */
  daysLeft: number;
  perDay: number;
  /** Where the month lands if the current daily rate holds. */
  projected: number;
  /** Still needed to reach the goal; 0 once met, null with no goal. */
  remainingToGoal: number | null;
  /** True when the current rate reaches the goal; null when there is no goal. */
  onTrack: boolean | null;
  /** How far off the goal the projection lands, as a fraction of it. Negative = short. */
  projectedGoalDelta: number | null;
};

/**
 * Pacing as of `today`, a date in the salon's own calendar. Only its year/month/day matter.
 *
 * Day 0 of next month is the last day of this one, which is how the month's length comes out
 * without a calendar table — `new Date(y, m + 1, 0)` normalises exactly as Dart's
 * `DateTime(y, m + 1, 0)` does, month 13 included.
 */
export function revenuePace(
  today: Date,
  { monthToDate, goal }: { monthToDate: number; goal?: number | null },
): RevenuePace {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = Math.min(Math.max(today.getDate(), 1), daysInMonth);
  const perDay = dayOfMonth <= 0 ? 0 : monthToDate / dayOfMonth;
  const projected = perDay * daysInMonth;
  // A goal of 0 is treated as no goal at all — the settings form stores 0 as null, so this is
  // the same state arriving by a different route.
  const g = goal != null && goal > 0 ? goal : null;
  const gap = g == null ? null : g - monthToDate;
  return {
    monthToDate,
    goal: g,
    dayOfMonth,
    daysInMonth,
    daysLeft: daysInMonth - dayOfMonth,
    perDay,
    projected,
    remainingToGoal: gap == null ? null : gap <= 0 ? 0 : gap,
    onTrack: g == null ? null : projected >= g,
    projectedGoalDelta: g == null ? null : (projected - g) / g,
  };
}

/**
 * The goal restated as work: how many more sales at `avgTicket` close the gap.
 *
 * "Nu 8,400 short" is a worry; "6 more cuts" is a plan.
 */
export function ticketsToGoal(pace: RevenuePace, avgTicket: number): number | null {
  const gap = pace.remainingToGoal;
  if (gap == null || gap <= 0 || avgTicket <= 0) return null;
  return Math.ceil(gap / avgTicket);
}

// ================================================================== deltas =====

/**
 * Change from `prev` to `now` as a fraction, or **null when `prev` is 0**.
 *
 * A percentage change from nothing is not information, and dividing by it would print
 * `Infinity%`. The UI hides the chip rather than showing a number it can't justify.
 */
export function deltaPct(now: number, prev: number): number | null {
  if (prev === 0) return null;
  return (now - prev) / prev;
}

/** "+12% vs last period", "same as last period", or null when there is no base. */
export function deltaLabel(now: number, prev: number): string | null {
  if (prev <= 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return "same as last period";
  return `${pct > 0 ? "+" : ""}${pct}% vs last period`;
}

// ============================================================== glance grid ====

export type GlanceTone = "neutral" | "good" | "bad";

export type GlanceStat = {
  key: string;
  label: string;
  value: string;
  detail: string | null;
  tone: GlanceTone;
};

/**
 * The four figures an owner asks for daily.
 *
 * Returns `[]` when there is nothing to show, so a salon in its first week renders nothing
 * rather than a grid of zeroes — an empty grid reads as "we have no data yet", four zeroes
 * read as "you did no business".
 *
 * Only two of the four carry a tone, and only where the direction is unambiguous: repeat
 * custom is the whole business model, and 10% is roughly where a salon starts losing real
 * money to empty chairs. A high average ticket is *not* automatically good, so it gets none.
 */
export function glanceStats(dash: DashboardData | null): GlanceStat[] {
  if (!dash) return [];
  const k = dash.kpis;
  const ops = dash.ops;
  const handled = ops.completed + ops.noShow + ops.cancelled;
  if (k.bookings === 0 && handled === 0) return [];

  const noShowPct = handled === 0 ? 0 : (ops.noShow / handled) * 100;
  const seen = dash.retention.newCustomers + dash.retention.returningCustomers;
  const returningPct = seen === 0 ? 0 : (dash.retention.returningCustomers / seen) * 100;

  return [
    {
      key: "revenue",
      label: "Revenue",
      value: formatNu(k.revenue),
      detail: deltaLabel(k.revenue, k.revenuePrev),
      tone: "neutral",
    },
    {
      key: "bookings",
      label: "Bookings",
      value: String(k.bookings),
      detail: deltaLabel(k.bookings, k.bookingsPrev),
      tone: "neutral",
    },
    {
      key: "returning",
      label: "Returning",
      value: `${Math.round(returningPct)}%`,
      detail: "of customers",
      tone: returningPct >= 50 ? "good" : "neutral",
    },
    {
      key: "noShows",
      label: "No-shows",
      value: `${Math.round(noShowPct)}%`,
      detail: `${ops.noShow} of ${handled}`,
      tone: noShowPct >= 10 ? "bad" : "good",
    },
  ];
}

// ========================================================= plain-words readings =

/**
 * A percentage only means something next to what it was, or what it implies. These are the
 * sentences that say so — the one line under each chart that turns a shape into advice.
 */

export function goalReading(pace: RevenuePace, avgTicket: number): string {
  if (pace.goal == null) {
    return "Set a monthly goal in Settings to track pace against a target.";
  }
  const onTrack = pace.onTrack ?? false;
  const projected = formatNu(pace.projected);
  if (pace.daysLeft <= 0) {
    return onTrack ? "Goal reached this month." : `Month closed at ${formatNu(pace.monthToDate)}.`;
  }
  const left = pace.daysLeft === 1 ? "1 day left" : `${pace.daysLeft} days left`;
  if (onTrack) return `At this rate you finish around ${projected} — ahead of goal, ${left}.`;
  const tickets = ticketsToGoal(pace, avgTicket);
  if (tickets == null) {
    return `At this rate you finish around ${projected}, short of goal, ${left}.`;
  }
  const sales = tickets === 1 ? "1 more booking" : `${tickets} more bookings`;
  return `At this rate you finish around ${projected}. ${sales} at your average ticket closes the gap, ${left}.`;
}

export function retentionReading(r: RetentionSplit): string {
  const total = r.newCustomers + r.returningCustomers;
  if (total === 0) return "No customers in this period yet.";
  const fraction = r.returningCustomers / total;
  const pct = Math.round(fraction * 100);
  if (fraction >= 0.6) return `${pct}% came back — a loyal base doing most of the work.`;
  if (fraction >= 0.35) {
    return `${pct}% came back. Healthy, with room to turn more first-timers into regulars.`;
  }
  return `${pct}% came back. Most customers are trying you once and not returning.`;
}

export function opsReading(o: OpsRates): string {
  const total = o.completed + o.noShow + o.cancelled;
  if (total === 0) return "No completed or missed bookings in this period.";
  const lost = o.noShow + o.cancelled;
  if (lost === 0) return "Every booking in this period happened.";
  const pct = Math.round((lost / total) * 100);
  return `${pct}% of bookings didn't happen — ${lost} of ${total}, ${o.noShow} of them no-shows.`;
}

/** Fraction of the goal banked so far, or null with no goal — the gauge reads "—" for null. */
export function goalFraction(goal: GoalProgress): number | null {
  if (goal.monthlyGoal == null || goal.monthlyGoal === 0) return null;
  return goal.monthToDateRevenue / goal.monthlyGoal;
}

// ============================================================== peak heatmap ===

export type HeatGrid = {
  /** `[dow][hour]`, 7 × 24, zero-filled. `dow` 0 = Sunday, as Postgres `extract(dow)`. */
  rows: number[][];
  max: number;
};

/**
 * A sparse cell list densified into the grid the heatmap draws.
 *
 * Out-of-range cells are dropped rather than clamped: a `dow` of 7 would silently overwrite
 * Sunday, and a wrong cell is worse than a missing one in a chart whose whole job is to show
 * where the week is busy.
 */
export function heatGrid(cells: HeatCell[]): HeatGrid {
  const rows: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  let max = 0;
  for (const c of cells) {
    if (c.dow < 0 || c.dow > 6 || c.hour < 0 || c.hour > 23) continue;
    rows[c.dow][c.hour] = c.count;
    if (c.count > max) max = c.count;
  }
  return { rows, max };
}

// ================================================================ client book ==

export type ClientSegment = "all" | "regulars" | "lapsed" | "upcoming" | "walkIns";

export const CLIENT_SEGMENTS: { value: ClientSegment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "regulars", label: "Regulars" },
  { value: "lapsed", label: "Lapsed" },
  { value: "upcoming", label: "Booked in" },
  { value: "walkIns", label: "Walk-ins" },
];

/**
 * How many completed visits before someone counts as a regular.
 *
 * Three, not two: a second visit is often a coincidence, a third is a habit, and the whole
 * point of the label is to tell staff who to treat as known.
 */
export const REGULAR_VISITS = 3;

/**
 * A regular who is overdue and has nothing booked.
 *
 * All three conditions matter. Someone with one visit isn't lapsed, they're new; and someone
 * already booked back in isn't lapsed however long it has been since they were in the chair.
 *
 * `lapsedAfterDays` comes from the salon's **own** rebooking window
 * (`businesses.rebooking_days`), so a barber whose customers come monthly and a colourist
 * whose customers come quarterly don't share one hard-coded idea of "overdue".
 */
export function isLapsed(
  c: ClientSummary,
  { lapsedAfterDays, now }: { lapsedAfterDays: number; now: Date },
): boolean {
  if (c.visits < REGULAR_VISITS) return false;
  if (c.nextUpcoming != null) return false;
  if (c.lastVisit == null) return false;
  return daysBetween(c.lastVisit, now) >= lapsedAfterDays;
}

/** Whole days from `from` to `to`, truncated — Dart's `Duration.inDays`. */
function daysBetween(from: Date, to: Date): number {
  return Math.trunc((to.getTime() - from.getTime()) / 86_400_000);
}

export function clientInSegment(
  c: ClientSummary,
  segment: ClientSegment,
  { lapsedAfterDays, now }: { lapsedAfterDays: number; now: Date },
): boolean {
  switch (segment) {
    case "all":
      return true;
    case "regulars":
      return c.visits >= REGULAR_VISITS;
    case "lapsed":
      return isLapsed(c, { lapsedAfterDays, now });
    case "upcoming":
      return c.nextUpcoming != null;
    case "walkIns":
      // No linked profile — the salon knows them only from the counter.
      return c.customerProfileId == null;
  }
}

/**
 * Days since the client was last in, or null if they never have been.
 *
 * Never negative — a visit stamped slightly in the future by clock skew reads as today. The
 * comparison is `> 0` rather than the Dart's `< 0` because `Math.trunc` of a small negative
 * yields **`-0`**, which is not a thing Dart's integer division can produce: it prints as
 * "0" but fails `Object.is(x, 0)`, so it would leak into a key or a cache without ever
 * looking wrong on screen.
 */
export function daysSinceVisit(c: ClientSummary, now: Date): number | null {
  if (c.lastVisit == null) return null;
  const days = daysBetween(c.lastVisit, now);
  return days > 0 ? days : 0;
}

export type ClientSort = "recent" | "spend" | "visits" | "name";

export const CLIENT_SORTS: { value: ClientSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "spend", label: "Top spend" },
  { value: "visits", label: "Most visits" },
  { value: "name", label: "Name" },
];

/**
 * Returns a **new** sorted list; never mutates the input.
 *
 * Clients who have never visited sort **last** under `recent` rather than first — a null date
 * is "no information", not "longest ago".
 */
export function sortClients(clients: ClientSummary[], sort: ClientSort): ClientSummary[] {
  const out = [...clients];
  switch (sort) {
    case "recent":
      out.sort((a, b) => {
        const av = a.lastVisit;
        const bv = b.lastVisit;
        if (av == null && bv == null) return a.displayName.localeCompare(b.displayName);
        if (av == null) return 1;
        if (bv == null) return -1;
        return bv.getTime() - av.getTime();
      });
      break;
    case "spend":
      out.sort((a, b) => b.totalSpend - a.totalSpend);
      break;
    case "visits":
      out.sort((a, b) => b.visits - a.visits);
      break;
    case "name":
      out.sort((a, b) =>
        a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()),
      );
      break;
  }
  return out;
}

/** Name or phone match, case-insensitive. An empty query matches everything. */
export function clientMatchesQuery(c: ClientSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return (
    c.displayName.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q)
  );
}

export type ClientBookStats = {
  total: number;
  regulars: number;
  lapsed: number;
  booked: number;
};

/** The four headline counts. `lapsed` is the only one that is bad news. */
export function clientBookStats(
  clients: ClientSummary[],
  { lapsedAfterDays, now }: { lapsedAfterDays: number; now: Date },
): ClientBookStats {
  let regulars = 0;
  let lapsed = 0;
  let booked = 0;
  for (const c of clients) {
    if (c.visits >= REGULAR_VISITS) regulars++;
    if (isLapsed(c, { lapsedAfterDays, now })) lapsed++;
    if (c.nextUpcoming != null) booked++;
  }
  return { total: clients.length, regulars, lapsed, booked };
}

// ==================================================================== orders ===

/**
 * Legal **owner** transitions — mirrors `set_order_status`'s server rules exactly.
 *
 * Every case is one-directional or terminal, which is why the order screen offers no Undo: a
 * reverse transition is never legal, so an Undo button could only be a button that always
 * fails. The Dart records the same reasoning at `order_detail_screen.dart:11`.
 */
export function canOwnerTransition(from: OrderStatus, to: OrderStatus): boolean {
  switch (from) {
    case "new":
      return to === "ready" || to === "declined";
    case "ready":
      return to === "collected" || to === "declined";
    default:
      return false; // collected / cancelled / declined are terminal
  }
}

/** A customer may cancel only while the order is still new. */
export function canCustomerCancel(from: OrderStatus): boolean {
  return from === "new";
}

/** Short human code, `ORD-` prefixed — mirrors `Order.code`, and `Booking.code`'s shape. */
export function orderCode(id: string): string {
  return `ORD-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  ready: "Ready",
  collected: "Collected",
  cancelled: "Cancelled",
  declined: "Declined",
};

/** The three segments of the owner's inbox, and which statuses each covers. */
export const ORDER_SEGMENTS: { value: string; label: string; statuses: OrderStatus[] }[] = [
  { value: "new", label: "New", statuses: ["new"] },
  { value: "ready", label: "Ready", statuses: ["ready"] },
  { value: "done", label: "Done", statuses: ["collected", "cancelled", "declined"] },
];

export function orderSegmentFor(value: string | null | undefined) {
  return ORDER_SEGMENTS.find((s) => s.value === value) ?? ORDER_SEGMENTS[0];
}

/** Total units in an order, not lines — two bottles of one oil is 2 items, not 1. */
export function orderItemCount(items: { qty: number }[]): number {
  return items.reduce((sum, it) => sum + it.qty, 0);
}

// ==================================================================== offers ===

/**
 * Why an offer is not currently visible to customers, or null when it is.
 *
 * The owner's list shows every offer, including the ones the public read policy filters out,
 * so each row has to say *which* of the three reasons applies — "Paused" and "Ended" and
 * "Starts" look identical on the page otherwise, and only one of them is something the owner
 * should act on.
 *
 * **Today is the salon's today, not the server's.** `offers_public_read` compares against
 * `(now() at time zone 'Asia/Thimphu')::date`, so this has to as well, and `thimphuToday` is the
 * helper that already does it. Comparing UTC calendar days instead — which the first version of
 * this did — makes the two disagree for the six hours of every Thimphu day that fall on the
 * previous UTC one: measured, an offer that ended yesterday still read **"Live"** on the owner's
 * page at 04:20 Thimphu while customers had already stopped seeing it. `ends_on` is a `date`
 * column, so it arrives as `YYYY-MM-DD` and parses to UTC midnight, which is exactly what
 * `thimphuToday` returns for the salon's day — the two are then comparable.
 *
 * An offer ending *today* is still live today, which is why the test is strictly `<`.
 */
export function offerHiddenReason(
  offer: Pick<Offer, "isActive" | "startsOn" | "endsOn">,
  now: Date,
  formatDay: (d: Date) => string,
): string | null {
  if (!offer.isActive) return "Paused";
  const today = thimphuToday(now).getTime();
  if (offer.endsOn != null && dayOf(offer.endsOn) < today) {
    return `Ended ${formatDay(offer.endsOn)}`;
  }
  if (offer.startsOn != null && dayOf(offer.startsOn) > today) {
    return `Starts ${formatDay(offer.startsOn)}`;
  }
  return null;
}

/** A `date` column's midnight, in the same frame `thimphuToday` returns. */
function dayOf(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// =================================================================== loyalty ===

/** Points a completed booking of `total` Nu would earn — mirrors the earn trigger. */
export function loyaltyPointsForBooking(program: LoyaltyProgram, total: number): number {
  if (program.earnMode === "per_spend") {
    return program.nuPerPoint <= 0 ? 0 : Math.floor(total / program.nuPerPoint);
  }
  return program.pointsPerVisit;
}

/** The customer-facing description of the earn rule, and the form's live preview. */
export function earnSentence(program: LoyaltyProgram): string {
  return program.earnMode === "per_spend"
    ? `Customers earn 1 point per Nu ${program.nuPerPoint} spent.`
    : `Customers earn ${program.pointsPerVisit} points every visit.`;
}

/** Short human label for a reward's value — "10% off", "Nu 100 off", "Free: Haircut". */
export function rewardValueLabel(
  r: Pick<LoyaltyReward, "rewardType" | "percentOff" | "amountNu" | "serviceRef" | "productRef" | "name">,
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
  const live = rewards
    .filter((r) => r.isActive && !r.isArchived)
    .sort((a, b) => a.pointCost - b.pointCost);
  if (live.length === 0) return { target: null, progress: 0 };
  for (const r of live) {
    if (r.pointCost > available) {
      return { target: r, progress: Math.min(Math.max(available / r.pointCost, 0), 1) };
    }
  }
  return { target: null, progress: 1 };
}

// ======================================================================= tax ===

/**
 * Progressive 2026 Bhutan PIT — **mirrors `private.pit_2026` in SQL exactly**.
 *
 * Duplicated rather than trusted so the server's figure can be checked: `tax_estimate` is the
 * only number in the console an owner might take to an accountant, and a silent drift between
 * the two implementations is exactly the kind of thing a unit test should catch.
 */
export function estimateIncomeTax(assessable: number): number {
  if (assessable <= 300_000) return 0;
  const band = (start: number, width: number, rate: number): number => {
    const over = assessable - start;
    if (over <= 0) return 0;
    return (over < width ? over : width) * rate;
  };
  return (
    band(300_000, 200_000, 0.05) +
    band(500_000, 250_000, 0.1) +
    band(750_000, 450_000, 0.15) +
    band(1_200_000, 800_000, 0.2) +
    band(2_000_000, 1_500_000, 0.25) +
    (assessable > 3_500_000 ? (assessable - 3_500_000) * 0.3 : 0)
  );
}

/** Bhutan requires GST registration once annual turnover reaches Nu 5,000,000. */
export const GST_THRESHOLD_NU = 5_000_000;
