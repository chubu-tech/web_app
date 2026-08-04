import type { Metadata } from "next";
import { InsightsBoard } from "@/components/owner/insights-board";
import { LockedTeaser } from "@/components/owner/insight-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { OrdersInboxCard } from "@/components/owner/orders-inbox-card";
import { PaywallButton } from "@/components/owner/paywall-button";
import { TodaySnapshot } from "@/components/owner/today-snapshot";
import { fetchBusinessHours } from "@/lib/api/discovery";
import { fetchDashboard, fetchPeakHeatmap } from "@/lib/api/owner-analytics";
import { countNewOrders } from "@/lib/api/owner-back-office";
import { fetchBusinessBookings } from "@/lib/api/owner";
import { openMinutesForWeekday } from "@/lib/calendar-logic";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { thimphuDayBoundsUtc, thimphuToday, thimphuWeekday } from "@/lib/time";
import { granularityFromString, type HeatCell } from "@/lib/types/analytics";

export const metadata: Metadata = { title: "Insights" };

/**
 * The owner's numbers — a port of `tho/app/lib/business/insights/insights_tab.dart`.
 *
 * Three answers to three questions, in the app's order: **today** (what is happening in the
 * next few hours — every plan), **at a glance** (the four figures), **trends** (how the salon is
 * doing over time — Growth and up).
 *
 * ## Basic does not fetch the dashboard at all
 *
 * `analytics_dashboard` has **no plan gate** — it authorises with `is_business_owner` and never
 * looks at `businesses.plan` — so a Basic owner calling it receives the complete payload. Full
 * analytics is a Growth entitlement, so the gate is `hasFeature(plan, "fullAnalytics")` here,
 * in the client, and it is the only gate there is. See `lib/api/owner-analytics.ts` for why
 * that is reported upstream rather than worked around, and why this page therefore *skips the
 * request* rather than fetching and hiding: a round trip for data the page has decided not to
 * draw, with a successful full-analytics response in the network log of a salon that hasn't
 * paid for it, is worse than either honest option.
 *
 * ## Every section fails alone
 *
 * Today's read, the dashboard and the heatmap are three separate awaits with three separate
 * catches. A dead heatmap costs the heatmap; it does not cost the page. That is the app's own
 * arrangement (`insights_tab.dart` gives each `FutureBuilder` its own error state) and it
 * matters most for the heatmap, whose RPC has never had a live caller before now.
 */
export default async function OwnerInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const { period } = await searchParams;
  const granularity = granularityFromString(period);
  const supabase = await createClient();

  // One clock for the whole page, resolved here: the countdown, the pacing line and the day
  // bounds all have to agree, and three renders reading their own `new Date()` eventually
  // won't. The rule 2d set for the calendar.
  const now = new Date();
  const today = thimphuToday(now);
  const bounds = thimphuDayBoundsUtc(today);

  const trends = hasFeature(active.plan, "fullAnalytics");
  const storefront = hasFeature(active.plan, "productStore");

  const [bookings, hours, newOrders] = await Promise.all([
    fetchBusinessBookings(supabase, active.id, bounds).catch(() => []),
    fetchBusinessHours(supabase, active.id).catch(() => []),
    storefront ? countNewOrders(supabase, active.id).catch(() => 0) : Promise.resolve(0),
  ]);

  const dash = trends
    ? await fetchDashboard(supabase, active.id, granularity).catch(() => null)
    : null;
  let heatCells: HeatCell[] = [];
  let heatFailed = false;
  if (trends) {
    heatCells = await fetchPeakHeatmap(supabase, active.id).catch(() => {
      heatFailed = true;
      return [] as HeatCell[];
    });
  }

  return (
    <div className="px-base py-lg gap-lg mx-auto flex w-full max-w-[1128px] flex-col tablet:px-lg">
      <div>
        <h1 className="text-display-lg text-ink font-medium">Insights</h1>
        <p className="text-caption-sm text-muted">{active.name}</p>
      </div>

      {storefront ? <OrdersInboxCard newCount={newOrders} /> : null}

      <TodaySnapshot
        bookings={bookings}
        now={now}
        openMinutes={openMinutesForWeekday(hours, thimphuWeekday(today))}
      />

      {!trends ? (
        <LockedTeaser
          title="See where the money comes from"
          message="Revenue trends, your busiest hours, top services and a staff leaderboard — on Growth and Pro."
          action={<PaywallButton feature="fullAnalytics" label="See plans" />}
        />
      ) : dash == null ? (
        <p className="text-body-sm text-muted">
          Couldn&apos;t load your trends. Today&apos;s figures above are unaffected — reload to
          try again.
        </p>
      ) : (
        <InsightsBoard
          dash={dash}
          heatCells={heatCells}
          heatFailed={heatFailed}
          granularity={granularity}
          today={today}
        />
      )}
    </div>
  );
}
