import { describe, expect, it } from "vitest";
import {
  canCustomerCancel,
  canOwnerTransition,
  clientBookStats,
  clientInSegment,
  clientMatchesQuery,
  daysSinceVisit,
  deltaLabel,
  deltaPct,
  earnSentence,
  estimateIncomeTax,
  glanceStats,
  goalFraction,
  goalReading,
  heatGrid,
  isLapsed,
  loyaltyPointsForBooking,
  offerHiddenReason,
  opsReading,
  orderCode,
  orderFulfilment,
  orderItemCount,
  orderSegmentCoverage,
  orderSegmentFor,
  orderStatusLabel,
  ORDER_STATUS_LABEL,
  progressToNext,
  retentionReading,
  revenuePace,
  rewardValueLabel,
  sortClients,
  ticketsToGoal,
  type ClientSegment,
  type ClientSort,
} from "./analytics";
import type { DashboardData } from "./types/analytics";
import { ORDER_STATUSES, orderStatusFromWire } from "./types/back-office";
import type { ClientSummary, LoyaltyProgram, LoyaltyReward } from "./types/back-office";

/**
 * The cases of `dashboard_logic_test.dart` (7) and `client_book_logic_test.dart` (18),
 * reproduced exactly, plus the derivations that live in widget statics upstream and so had no
 * Dart test of their own: the glance grid, the three readings, the heat grid, the order state
 * machine, offer visibility, loyalty earning and the PIT bands.
 *
 * Where a Dart case reads `DateTime(2026, 6, 10)` — a *local* date — the port uses
 * `new Date(2026, 5, 10)`, also local, because `revenuePace` reads only year/month/day and a
 * UTC constructor would shift the day for anyone east of Greenwich, which is everyone here.
 */

// ============================================================ revenue pacing ===

describe("revenuePace", () => {
  it("projects the month from the current daily rate", () => {
    // Nu 12,000 over 10 days of a 30-day month -> Nu 1,200/day -> Nu 36,000.
    const pace = revenuePace(new Date(2026, 5, 10), { monthToDate: 12000, goal: 40000 });
    expect(pace.daysInMonth).toBe(30);
    expect(pace.dayOfMonth).toBe(10);
    expect(pace.daysLeft).toBe(20);
    expect(pace.perDay).toBe(1200);
    expect(pace.projected).toBe(36000);
  });

  it("knows month lengths, including February in a leap year", () => {
    expect(revenuePace(new Date(2026, 1, 1), { monthToDate: 0 }).daysInMonth).toBe(28);
    expect(revenuePace(new Date(2028, 1, 1), { monthToDate: 0 }).daysInMonth).toBe(29);
    expect(revenuePace(new Date(2026, 11, 31), { monthToDate: 0 }).daysInMonth).toBe(31);
  });

  it("flags on/off track and the remaining gap", () => {
    const behind = revenuePace(new Date(2026, 5, 15), { monthToDate: 10000, goal: 30000 });
    expect(behind.projected).toBe(20000);
    expect(behind.onTrack).toBe(false);
    expect(behind.remainingToGoal).toBe(20000);
    expect(behind.projectedGoalDelta).toBeCloseTo(-1 / 3, 9);

    const ahead = revenuePace(new Date(2026, 5, 15), { monthToDate: 20000, goal: 30000 });
    expect(ahead.projected).toBe(40000);
    expect(ahead.onTrack).toBe(true);
  });

  it("with no goal there is nothing to be on track for", () => {
    const pace = revenuePace(new Date(2026, 5, 15), { monthToDate: 10000 });
    expect(pace.onTrack).toBeNull();
    expect(pace.remainingToGoal).toBeNull();
    expect(pace.projectedGoalDelta).toBeNull();
    expect(ticketsToGoal(pace, 500)).toBeNull();
  });

  it("a met goal leaves nothing remaining", () => {
    const pace = revenuePace(new Date(2026, 5, 20), { monthToDate: 31000, goal: 30000 });
    expect(pace.remainingToGoal).toBe(0);
    expect(ticketsToGoal(pace, 500)).toBeNull();
  });

  it("restates the gap as a number of average tickets, rounding up", () => {
    // Nu 2,600 short at a Nu 500 ticket is 5.2 sales -> 6.
    const pace = revenuePace(new Date(2026, 5, 20), { monthToDate: 27400, goal: 30000 });
    expect(pace.remainingToGoal).toBe(2600);
    expect(ticketsToGoal(pace, 500)).toBe(6);
    // No ticket size to divide by.
    expect(ticketsToGoal(pace, 0)).toBeNull();
  });

  it("day one does not divide by zero", () => {
    const pace = revenuePace(new Date(2026, 5, 1), { monthToDate: 500, goal: 30000 });
    expect(pace.perDay).toBe(500);
    expect(pace.projected).toBe(15000);
    expect(pace.daysLeft).toBe(29);
  });

  it("treats a goal of 0 as no goal, matching how settings stores it", () => {
    // `businesses.monthly_revenue_goal` keeps 0 as null, so both routes must agree.
    const pace = revenuePace(new Date(2026, 5, 15), { monthToDate: 10000, goal: 0 });
    expect(pace.goal).toBeNull();
    expect(pace.onTrack).toBeNull();
  });
});

describe("goalReading", () => {
  const on = (mtd: number, goal: number | null, day: number) =>
    revenuePace(new Date(2026, 5, day), { monthToDate: mtd, goal });

  it("sends an owner with no goal to settings", () => {
    expect(goalReading(on(10000, null, 15), 500)).toMatch(/Set a monthly goal in Settings/);
  });

  it("restates a shortfall as bookings", () => {
    // Nu 15,000 over 20 days projects to Nu 22,500 — Nu 15,000 short, 30 tickets at Nu 500.
    // (Note the pace, not the balance, decides: Nu 27,400 by day 20 is *behind* on paper but
    // projects past a Nu 30,000 goal, so it reads as ahead — see the case below.)
    expect(goalReading(on(15000, 30000, 20), 500)).toBe(
      "At this rate you finish around Nu 22,500. 30 more bookings at your average ticket closes the gap, 10 days left.",
    );
  });

  it("calls a month ahead of goal ahead, even with the goal not yet banked", () => {
    expect(goalReading(on(27400, 30000, 20), 500)).toBe(
      "At this rate you finish around Nu 41,100 — ahead of goal, 10 days left.",
    );
  });

  it("says ahead of goal when the rate gets there", () => {
    expect(goalReading(on(20000, 30000, 15), 500)).toMatch(/ahead of goal, 15 days left\./);
  });

  it("on the last day, reports the month rather than a rate", () => {
    expect(goalReading(on(31000, 30000, 30), 500)).toBe("Goal reached this month.");
    expect(goalReading(on(20000, 30000, 30), 500)).toBe("Month closed at Nu 20,000.");
  });

  it("singularises one day and one booking", () => {
    expect(goalReading(on(28000, 30000, 29), 2000)).toMatch(/1 more booking at your average/);
    expect(goalReading(on(28000, 30000, 29), 2000)).toMatch(/1 day left\.$/);
  });
});

// ================================================================== deltas =====

describe("deltaPct / deltaLabel", () => {
  it("is null against a zero base, because that is not a percentage", () => {
    expect(deltaPct(100, 0)).toBeNull();
    expect(deltaLabel(100, 0)).toBeNull();
    expect(deltaLabel(100, -5)).toBeNull();
  });

  it("signs the rise and names the fall", () => {
    expect(deltaPct(120, 100)).toBeCloseTo(0.2, 9);
    expect(deltaLabel(120, 100)).toBe("+20% vs last period");
    expect(deltaLabel(80, 100)).toBe("-20% vs last period");
    expect(deltaLabel(100, 100)).toBe("same as last period");
  });
});

// ============================================================== glance grid ====

const DASH: DashboardData = {
  kpis: {
    revenue: 12000,
    revenuePrev: 10000,
    bookings: 40,
    bookingsPrev: 32,
    avgTicket: 300,
    avgTicketPrev: 312,
    utilization: 0.62,
    utilizationPrev: 0.5,
  },
  revenue: [],
  retention: { newCustomers: 8, returningCustomers: 12 },
  topStaff: [],
  topServices: [],
  ops: { completed: 34, noShow: 4, cancelled: 2 },
  goal: { monthlyGoal: 30000, monthToDateRevenue: 12000 },
};

describe("glanceStats", () => {
  it("is empty with no dashboard at all", () => {
    expect(glanceStats(null)).toEqual([]);
  });

  it("is empty on a salon that has done nothing, rather than four zeroes", () => {
    const blank: DashboardData = {
      ...DASH,
      kpis: { ...DASH.kpis, bookings: 0 },
      ops: { completed: 0, noShow: 0, cancelled: 0 },
    };
    expect(glanceStats(blank)).toEqual([]);
  });

  it("reads the four figures, with deltas where there is a base", () => {
    const stats = glanceStats(DASH);
    expect(stats.map((s) => s.key)).toEqual(["revenue", "bookings", "returning", "noShows"]);
    expect(stats[0].value).toBe("Nu 12,000");
    expect(stats[0].detail).toBe("+20% vs last period");
    // 12 of 20 seen customers came back.
    expect(stats[2].value).toBe("60%");
    // 4 no-shows of 40 handled = 10%.
    expect(stats[3].value).toBe("10%");
    expect(stats[3].detail).toBe("4 of 40");
  });

  it("colours only the two figures whose direction is unambiguous", () => {
    const stats = glanceStats(DASH);
    expect(stats[0].tone).toBe("neutral");
    expect(stats[1].tone).toBe("neutral");
    // >= 50% returning is good news; >= 10% no-shows is bad, and 10% is exactly the line.
    expect(stats[2].tone).toBe("good");
    expect(stats[3].tone).toBe("bad");
  });

  it("calls a low no-show rate good rather than neutral", () => {
    const clean: DashboardData = { ...DASH, ops: { completed: 40, noShow: 0, cancelled: 0 } };
    expect(glanceStats(clean)[3].tone).toBe("good");
  });
});

// ========================================================== chart readings =====

describe("readings", () => {
  it("grades retention in three bands", () => {
    expect(retentionReading({ newCustomers: 0, returningCustomers: 0 })).toBe(
      "No customers in this period yet.",
    );
    expect(retentionReading({ newCustomers: 3, returningCustomers: 7 })).toMatch(
      /70% came back — a loyal base/,
    );
    expect(retentionReading({ newCustomers: 6, returningCustomers: 4 })).toMatch(
      /40% came back\. Healthy/,
    );
    expect(retentionReading({ newCustomers: 8, returningCustomers: 2 })).toMatch(
      /trying you once and not returning/,
    );
  });

  it("says plainly when nothing was lost", () => {
    expect(opsReading({ completed: 0, noShow: 0, cancelled: 0 })).toBe(
      "No completed or missed bookings in this period.",
    );
    expect(opsReading({ completed: 10, noShow: 0, cancelled: 0 })).toBe(
      "Every booking in this period happened.",
    );
    expect(opsReading({ completed: 34, noShow: 4, cancelled: 2 })).toBe(
      "15% of bookings didn't happen — 6 of 40, 4 of them no-shows.",
    );
  });

  it("has no gauge fraction without a goal", () => {
    expect(goalFraction({ monthlyGoal: null, monthToDateRevenue: 900 })).toBeNull();
    expect(goalFraction({ monthlyGoal: 0, monthToDateRevenue: 900 })).toBeNull();
    expect(goalFraction({ monthlyGoal: 3000, monthToDateRevenue: 900 })).toBeCloseTo(0.3, 9);
  });
});

// ============================================================== peak heatmap ===

describe("heatGrid", () => {
  it("densifies a sparse list into 7 x 24 and finds the max", () => {
    const g = heatGrid([
      { dow: 0, hour: 9, count: 3 },
      { dow: 6, hour: 23, count: 7 },
    ]);
    expect(g.rows).toHaveLength(7);
    expect(g.rows[0]).toHaveLength(24);
    expect(g.rows[0][9]).toBe(3);
    expect(g.rows[6][23]).toBe(7);
    expect(g.rows[3][3]).toBe(0);
    expect(g.max).toBe(7);
  });

  it("drops an out-of-range cell rather than clamping it onto Sunday", () => {
    const g = heatGrid([
      { dow: 7, hour: 9, count: 99 },
      { dow: 0, hour: 24, count: 99 },
      { dow: -1, hour: 0, count: 99 },
    ]);
    expect(g.max).toBe(0);
    expect(g.rows[0][9]).toBe(0);
  });
});

// ================================================================ client book ==

const NOW = new Date("2026-08-01T12:00:00Z");

function client(over: Partial<ClientSummary> & { lastVisitDaysAgo?: number | null } = {}): ClientSummary {
  const { lastVisitDaysAgo = 10, ...rest } = over;
  return {
    customerProfileId: "p1",
    displayName: "Dechen",
    phone: "17123456",
    visits: 5,
    totalSpend: 3000,
    lastVisit:
      lastVisitDaysAgo == null ? null : new Date(NOW.getTime() - lastVisitDaysAgo * 86_400_000),
    nextUpcoming: null,
    hasNote: false,
    groupKey: "p1",
    ...rest,
  };
}

const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("isLapsed", () => {
  const lapsed = (c: ClientSummary, days = 42) =>
    isLapsed(c, { lapsedAfterDays: days, now: NOW });

  it("a regular past the window with nothing booked is lapsed", () => {
    expect(lapsed(client({ visits: 6, lastVisitDaysAgo: 60 }))).toBe(true);
  });

  it("a regular who is already booked back in is not lapsed", () => {
    // However long it has been, they are not lost — chasing them would be wrong and
    // slightly insulting.
    expect(
      lapsed(client({ visits: 6, lastVisitDaysAgo: 90, nextUpcoming: inDays(2) })),
    ).toBe(false);
  });

  it("someone with one or two visits is new, not lapsed", () => {
    expect(lapsed(client({ visits: 1, lastVisitDaysAgo: 200 }))).toBe(false);
    expect(lapsed(client({ visits: 2, lastVisitDaysAgo: 200 }))).toBe(false);
  });

  it("a client who has never visited is not lapsed", () => {
    expect(lapsed(client({ visits: 5, lastVisitDaysAgo: null }))).toBe(false);
  });

  it("exactly at the window counts as lapsed", () => {
    expect(lapsed(client({ visits: 5, lastVisitDaysAgo: 42 }))).toBe(true);
    expect(lapsed(client({ visits: 5, lastVisitDaysAgo: 41 }))).toBe(false);
  });

  it("the window comes from the salon, not a constant", () => {
    const c = client({ visits: 5, lastVisitDaysAgo: 40 });
    expect(lapsed(c, 30)).toBe(true);
    expect(lapsed(c, 90)).toBe(false);
  });
});

describe("clientInSegment", () => {
  const inSeg = (c: ClientSummary, s: ClientSegment) =>
    clientInSegment(c, s, { lapsedAfterDays: 42, now: NOW });

  it("All takes everyone", () => {
    expect(inSeg(client({ visits: 0 }), "all")).toBe(true);
  });

  it("Regulars needs three visits", () => {
    expect(inSeg(client({ visits: 2 }), "regulars")).toBe(false);
    expect(inSeg(client({ visits: 3 }), "regulars")).toBe(true);
  });

  it("Booked in is anyone with a next appointment", () => {
    expect(inSeg(client({ nextUpcoming: inDays(3) }), "upcoming")).toBe(true);
    expect(inSeg(client(), "upcoming")).toBe(false);
  });

  it("Walk-ins are the clients with no linked profile", () => {
    expect(inSeg(client({ customerProfileId: null }), "walkIns")).toBe(true);
    expect(inSeg(client({ customerProfileId: "p1" }), "walkIns")).toBe(false);
  });
});

describe("sortClients", () => {
  const a = client({ displayName: "Aana", visits: 2, totalSpend: 900, lastVisitDaysAgo: 30 });
  const b = client({ displayName: "Bumpa", visits: 9, totalSpend: 200, lastVisitDaysAgo: 2 });
  const c = client({ displayName: "Choki", visits: 5, totalSpend: 5000, lastVisitDaysAgo: 90 });
  const never = client({
    displayName: "Zangmo",
    visits: 0,
    totalSpend: 0,
    lastVisitDaysAgo: null,
  });
  const all = [a, b, c, never];

  it("does not mutate the input", () => {
    const input = [...all];
    sortClients(input, "spend");
    expect(input).toEqual(all);
  });

  it("Recent puts the most recent visit first", () => {
    expect(sortClients(all, "recent")[0].displayName).toBe("Bumpa");
  });

  it("Recent sorts never-visited clients LAST, not first", () => {
    // A null date means "no information", not "longest ago" — a naive comparator would
    // float them to the top of a screen about recency.
    const out = sortClients(all, "recent");
    expect(out[out.length - 1].displayName).toBe("Zangmo");
  });

  it("Top spend and Most visits order by their own figure", () => {
    expect(sortClients(all, "spend")[0].displayName).toBe("Choki");
    expect(sortClients(all, "visits")[0].displayName).toBe("Bumpa");
  });

  it("Name is case-insensitive alphabetical", () => {
    const out = sortClients(
      [client({ displayName: "zeta" }), client({ displayName: "Alpha" })],
      "name" as ClientSort,
    );
    expect(out.map((e) => e.displayName)).toEqual(["Alpha", "zeta"]);
  });
});

describe("clientMatchesQuery", () => {
  it("an empty query matches everyone", () => {
    expect(clientMatchesQuery(client(), "")).toBe(true);
    expect(clientMatchesQuery(client(), "   ")).toBe(true);
  });

  it("matches name or phone, case-insensitively", () => {
    const c = client({ displayName: "Dechen Wangmo", phone: "17123456" });
    expect(clientMatchesQuery(c, "wangmo")).toBe(true);
    expect(clientMatchesQuery(c, "DECHEN")).toBe(true);
    expect(clientMatchesQuery(c, "1712")).toBe(true);
    expect(clientMatchesQuery(c, "tashi")).toBe(false);
  });

  it("a client with no phone is still searchable by name", () => {
    expect(clientMatchesQuery(client({ displayName: "Karma", phone: null }), "karma")).toBe(true);
  });
});

it("clientBookStats counts each headline independently", () => {
  const stats = clientBookStats(
    [
      client({ displayName: "new", visits: 1, lastVisitDaysAgo: 3 }),
      client({ displayName: "regular", visits: 5, lastVisitDaysAgo: 5 }),
      client({ displayName: "lapsed", visits: 8, lastVisitDaysAgo: 100 }),
      client({
        displayName: "booked",
        visits: 4,
        lastVisitDaysAgo: 100,
        nextUpcoming: inDays(1),
      }),
    ],
    { lapsedAfterDays: 42, now: NOW },
  );
  expect(stats.total).toBe(4);
  // regular + lapsed + booked all have >= 3 visits.
  expect(stats.regulars).toBe(3);
  // Only the one that is overdue AND has nothing booked.
  expect(stats.lapsed).toBe(1);
  expect(stats.booked).toBe(1);
});

it("daysSinceVisit never reports a negative", () => {
  // A visit stamped slightly in the future (clock skew) reads as today.
  const future = client({ lastVisit: new Date(NOW.getTime() + 3 * 3_600_000) });
  expect(daysSinceVisit(future, NOW)).toBe(0);
  expect(daysSinceVisit(client({ lastVisitDaysAgo: null }), NOW)).toBeNull();
  expect(daysSinceVisit(client({ lastVisitDaysAgo: 7 }), NOW)).toBe(7);
});

// ==================================================================== orders ===

/*
  **Every `OrderStatus`, derived — not a list written beside the tests that walk it.**

  This was a hand-written literal, and the coverage test below claimed in its own comment to
  "walk the union rather than a list written beside it" while doing exactly the latter: adding a
  value to `OrderStatus` and forgetting both `ORDER_SEGMENTS` and this array left every assertion
  green, which is the same silent pass that let `out_for_delivery` go uncovered for four days.

  `ORDER_STATUS_LABEL` is typed `Record<OrderStatus, string>`, so the union is what forces its
  keys — a new status is a type error *there* before it is anything here. Reading the keys back
  makes that the single point the whole chain hangs from: the union forces a label, the label
  fills this list, and this list is what the segment-coverage test measures `ORDER_SEGMENTS`
  against. Forget the segment and the test fails; forget the label and it does not compile.
*/
const ALL_ORDER_STATUSES = Object.keys(ORDER_STATUS_LABEL) as (keyof typeof ORDER_STATUS_LABEL)[];

describe("canOwnerTransition", () => {
  it("allows exactly what set_order_status allows on a pickup order", () => {
    expect(canOwnerTransition("new", "ready", "pickup")).toBe(true);
    expect(canOwnerTransition("new", "declined", "pickup")).toBe(true);
    expect(canOwnerTransition("ready", "collected", "pickup")).toBe(true);
    expect(canOwnerTransition("ready", "declined", "pickup")).toBe(true);
  });

  it("allows exactly what it allows on a delivery order", () => {
    expect(canOwnerTransition("new", "ready", "delivery")).toBe(true);
    expect(canOwnerTransition("ready", "out_for_delivery", "delivery")).toBe(true);
    expect(canOwnerTransition("out_for_delivery", "delivered", "delivery")).toBe(true);
    expect(canOwnerTransition("ready", "declined", "delivery")).toBe(true);
  });

  /*
    The gate, from both sides. `20260814000006` refuses each lifecycle's move on the other's
    order — "so a pickup order can never reach out_for_delivery and a delivery order can never be
    marked collected" — and offering either would be a button that always raises. This is the pair
    of assertions the console was failing before the fulfilment argument existed.
  */
  it("refuses each lifecycle's moves on the other's order", () => {
    expect(canOwnerTransition("ready", "out_for_delivery", "pickup")).toBe(false);
    expect(canOwnerTransition("ready", "collected", "delivery")).toBe(false);
    expect(canOwnerTransition("out_for_delivery", "delivered", "pickup")).toBe(false);
  });

  it("refuses skipping ready, and every terminal state", () => {
    expect(canOwnerTransition("new", "collected", "pickup")).toBe(false);
    expect(canOwnerTransition("new", "out_for_delivery", "delivery")).toBe(false);
    expect(canOwnerTransition("new", "delivered", "delivery")).toBe(false);
    for (const from of ["collected", "delivered", "cancelled", "declined"] as const) {
      for (const to of ALL_ORDER_STATUSES) {
        expect(canOwnerTransition(from, to, "pickup")).toBe(false);
        expect(canOwnerTransition(from, to, "delivery")).toBe(false);
      }
    }
  });

  it("never allows the reverse of a legal move — which is why there is no Undo", () => {
    expect(canOwnerTransition("ready", "new", "pickup")).toBe(false);
    expect(canOwnerTransition("collected", "ready", "pickup")).toBe(false);
    expect(canOwnerTransition("declined", "new", "pickup")).toBe(false);
    expect(canOwnerTransition("out_for_delivery", "ready", "delivery")).toBe(false);
    expect(canOwnerTransition("delivered", "out_for_delivery", "delivery")).toBe(false);
  });

  /*
    Declining is legal from `new` and `ready` only. Once the goods are with the driver the server
    refuses it, and the console renders no Decline button — this pins the rule the button reads.
  */
  it("refuses a decline once the order is out for delivery", () => {
    expect(canOwnerTransition("out_for_delivery", "declined", "delivery")).toBe(false);
  });

  it("lets a customer cancel only while the order is new", () => {
    expect(canCustomerCancel("new")).toBe(true);
    expect(canCustomerCancel("ready")).toBe(false);
    expect(canCustomerCancel("collected")).toBe(false);
    expect(canCustomerCancel("out_for_delivery")).toBe(false);
    expect(canCustomerCancel("delivered")).toBe(false);
  });
});

describe("orderFulfilment", () => {
  it("treats a null column as pickup, exactly as the server's coalesce does", () => {
    expect(orderFulfilment({ fulfilment: null })).toBe("pickup");
    expect(orderFulfilment({ fulfilment: "pickup" })).toBe("pickup");
    expect(orderFulfilment({ fulfilment: "delivery" })).toBe("delivery");
  });
});

it("orderCode is ORD- plus eight upper-case hex", () => {
  expect(orderCode("1c000000-0000-4000-8000-000000000001")).toBe("ORD-1C000000");
  expect(orderCode("034f7cc1-a790-4c3a-9410-2c6eca1dace2")).toBe("ORD-034F7CC1");
});

it("counts units, not lines", () => {
  expect(orderItemCount([{ qty: 2 }, { qty: 1 }])).toBe(3);
  expect(orderItemCount([])).toBe(0);
});

it("falls back to the New segment for an unknown status param", () => {
  expect(orderSegmentFor("ready").statuses).toEqual(["ready"]);
  expect(orderSegmentFor("delivering").statuses).toEqual(["out_for_delivery"]);
  expect(orderSegmentFor("done").statuses).toEqual([
    "collected",
    "delivered",
    "cancelled",
    "declined",
  ]);
  expect(orderSegmentFor("nonsense").value).toBe("new");
  expect(orderSegmentFor(null).value).toBe("new");
});

/*
  **The regression test for the bug this suite could not have caught before.**

  `order_status` grew by two values in `20260814000001` and the segments did not follow, so an
  `out_for_delivery` order was in no segment — and because the inbox filters `.in("status", …)`, a
  live order appeared in none of the owner's lists at all. Nothing failed: every existing assertion
  was about the statuses the segments *did* cover.

  What makes this test work is that it walks a list derived from the union rather than one written
  beside it — see `ALL_ORDER_STATUSES` above, which reads `ORDER_STATUS_LABEL`'s keys. Add a value
  to `OrderStatus` and forget the segment, and this fails.
*/
it("covers every order status in exactly one segment", () => {
  const covered = orderSegmentCoverage();
  expect([...covered].sort()).toEqual([...ALL_ORDER_STATUSES].sort());
  expect(new Set(covered).size).toBe(covered.length);
});

it("names its own empty state rather than deriving one from the tab label", () => {
  // "No delivering orders" is what deriving it produced.
  expect(orderSegmentFor("delivering").empty).toBe("Nothing out for delivery");
  expect(orderSegmentFor("new").empty).toBe("No new orders");
});

describe("ORDER_STATUS_LABEL", () => {
  it("gives every status words a person would say", () => {
    expect(ORDER_STATUS_LABEL.out_for_delivery).toBe("Out for delivery");
    expect(ORDER_STATUS_LABEL.delivered).toBe("Delivered");
  });

  /*
    Completeness is the type's job, not this test's: `Record<OrderStatus, string>` refuses to
    compile with a member missing, which is stronger than any assertion here could be. What is
    left to check is that each entry is *words* — the pill title-cases the wire value when a label
    is missing or empty, which is how `out_for_delivery` reached a customer as "Out_for_delivery".
  */
  it("gives every entry words rather than a wire value", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(ORDER_STATUS_LABEL[status]).toBeTruthy();
      expect(ORDER_STATUS_LABEL[status]).not.toContain("_");
    }
  });
});

describe("orderStatusFromWire", () => {
  it("round-trips every wire value and fails safe to new", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(orderStatusFromWire(status)).toBe(status);
    }
    // Deliberately `new`, not a terminal value: a finished order is one nobody looks at
    // again, and an unrecognised status must land somewhere a person still works through.
    expect(orderStatusFromWire("nonsense")).toBe("new");
    expect(orderStatusFromWire(null)).toBe("new");
    expect(orderStatusFromWire(undefined)).toBe("new");
  });

  /*
    The guard and the label table must know the same seven values. They are declared in two
    files — the union in `types/back-office.ts`, the words in `analytics.ts` — and it was
    exactly that kind of split that let the enum grow by two without either following.
  */
  it("accepts precisely the statuses that have a label", () => {
    expect([...ORDER_STATUSES].sort()).toEqual([...ALL_ORDER_STATUSES].sort());
  });
});

describe("orderStatusLabel", () => {
  it("relabels `new` for the customer and leaves it alone for the salon", () => {
    expect(orderStatusLabel("new", "customer")).toBe("Placed");
    expect(orderStatusLabel("new", "owner")).toBe("New");
  });

  /*
    The property that matters more than the one exception: the two audiences must not silently
    drift apart on any status nobody deliberately split. This is what a fifth copy of
    `status === "new" ? … : …` could not have given, and it walks the derived list, so a new
    status is covered the day it is added.
  */
  it("agrees with the base table on every status it does not deliberately relabel", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(orderStatusLabel(status, "owner")).toBe(ORDER_STATUS_LABEL[status]);
      if (status !== "new") {
        expect(orderStatusLabel(status, "customer")).toBe(ORDER_STATUS_LABEL[status]);
      }
      expect(orderStatusLabel(status, "customer")).toBeTruthy();
    }
  });
});

// ==================================================================== offers ===

describe("offerHiddenReason", () => {
  const day = (d: Date) => `${d.getUTCDate()} Aug`;
  const now = new Date("2026-08-05T06:00:00Z");
  const d = (iso: string) => new Date(iso);

  it("names the pause before anything else", () => {
    expect(
      offerHiddenReason({ isActive: false, startsOn: null, endsOn: null }, now, day),
    ).toBe("Paused");
  });

  it("is live when active and in window", () => {
    expect(
      offerHiddenReason({ isActive: true, startsOn: null, endsOn: null }, now, day),
    ).toBeNull();
    expect(
      offerHiddenReason(
        { isActive: true, startsOn: d("2026-08-01"), endsOn: d("2026-08-31") },
        now,
        day,
      ),
    ).toBeNull();
  });

  it("counts a same-day end as still running, matching the read policy", () => {
    expect(
      offerHiddenReason({ isActive: true, startsOn: null, endsOn: d("2026-08-05") }, now, day),
    ).toBeNull();
    expect(
      offerHiddenReason({ isActive: true, startsOn: null, endsOn: d("2026-08-04") }, now, day),
    ).toBe("Ended 4 Aug");
  });

  it("counts a same-day start as already running", () => {
    expect(
      offerHiddenReason({ isActive: true, startsOn: d("2026-08-05"), endsOn: null }, now, day),
    ).toBeNull();
    expect(
      offerHiddenReason({ isActive: true, startsOn: d("2026-08-09"), endsOn: null }, now, day),
    ).toBe("Starts 9 Aug");
  });

  /**
   * The bug this pins down was found in the browser, not here: the first version compared UTC
   * calendar days, so for the six hours of each Thimphu day that fall on the previous UTC one, an
   * offer that had ended still read "Live" on the owner's page while `offers_public_read` had
   * already hidden it from customers.
   */
  it("uses the salon's calendar day, not the server's", () => {
    // 2026-08-04T22:20Z is already 2026-08-05 04:20 in Thimphu. An offer ending 4 Aug has
    // therefore ended, even though the UTC date still says the 4th.
    const lateUtc = new Date("2026-08-04T22:20:00Z");
    expect(
      offerHiddenReason({ isActive: true, startsOn: null, endsOn: d("2026-08-04") }, lateUtc, day),
    ).toBe("Ended 4 Aug");
    // And one ending on the salon's today is still live.
    expect(
      offerHiddenReason({ isActive: true, startsOn: null, endsOn: d("2026-08-05") }, lateUtc, day),
    ).toBeNull();
    // The same instant, one day either side of a start date.
    expect(
      offerHiddenReason({ isActive: true, startsOn: d("2026-08-05"), endsOn: null }, lateUtc, day),
    ).toBeNull();
    expect(
      offerHiddenReason({ isActive: true, startsOn: d("2026-08-06"), endsOn: null }, lateUtc, day),
    ).toBe("Starts 6 Aug");
  });
});

// =================================================================== loyalty ===

const PROGRAM: LoyaltyProgram = {
  businessId: "b1",
  isActive: true,
  earnMode: "per_visit",
  pointsPerVisit: 10,
  nuPerPoint: 10,
};

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

describe("rewardValueLabel", () => {
  it("labels each of the four shapes", () => {
    expect(rewardValueLabel(reward())).toBe("10% off");
    expect(
      rewardValueLabel(
        reward({ rewardType: "fixed_discount", percentOff: null, amountNu: 100 }),
      ),
    ).toBe("Nu 100 off");
    expect(
      rewardValueLabel(
        reward({ rewardType: "free_service", percentOff: null, serviceRef: "Haircut" }),
      ),
    ).toBe("Free: Haircut");
    expect(
      rewardValueLabel(reward({ rewardType: "free_product", percentOff: null })),
    ).toBe("Free goodie");
  });
});

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

// ======================================================================= tax ===

/**
 * Every figure below was read straight out of `private.pit_2026` — `select private.pit_2026(v)`
 * over the same ten inputs — so this block is a cross-check between two implementations of one
 * tax table, not an assertion about what the bands *should* be. If the SQL ever changes, these
 * fail, which is the whole point of duplicating it.
 */
describe("estimateIncomeTax", () => {
  it("is nothing up to the threshold", () => {
    expect(estimateIncomeTax(0)).toBe(0);
    expect(estimateIncomeTax(300_000)).toBe(0);
  });

  it("charges each band at its own rate", () => {
    // 100k into the 5% band.
    expect(estimateIncomeTax(400_000)).toBeCloseTo(5_000, 6);
    // The whole 5% band.
    expect(estimateIncomeTax(500_000)).toBeCloseTo(10_000, 6);
    // 5% band full + the whole 10% band.
    expect(estimateIncomeTax(750_000)).toBeCloseTo(10_000 + 25_000, 6);
    // ... + the whole 15% band.
    expect(estimateIncomeTax(1_200_000)).toBeCloseTo(35_000 + 67_500, 6);
    // ... + the whole 20% band.
    expect(estimateIncomeTax(2_000_000)).toBeCloseTo(102_500 + 160_000, 6);
    // ... + the whole 25% band.
    expect(estimateIncomeTax(3_500_000)).toBeCloseTo(262_500 + 375_000, 6);
  });

  it("charges everything above Nu 3.5M at 30%", () => {
    expect(estimateIncomeTax(4_500_000)).toBeCloseTo(637_500 + 300_000, 6);
  });

  it("is continuous across every band boundary", () => {
    for (const edge of [300_000, 500_000, 750_000, 1_200_000, 2_000_000, 3_500_000]) {
      const below = estimateIncomeTax(edge - 1);
      const at = estimateIncomeTax(edge);
      const above = estimateIncomeTax(edge + 1);
      expect(at - below).toBeLessThan(1);
      expect(above - at).toBeLessThan(1);
    }
  });
});
