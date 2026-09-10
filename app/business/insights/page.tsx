import type { Metadata } from "next";
import { InsightsBoard } from "@/components/owner/insights-board";
import { LockedTeaser } from "@/components/owner/insight-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { OrdersInboxCard } from "@/components/owner/orders-inbox-card";
import { PaywallButton } from "@/components/owner/paywall-button";
import { SalonReviewStatus } from "@/components/owner/salon-review-status";
import { TodaySnapshot } from "@/components/owner/today-snapshot";
import { fetchBusinessHours } from "@/lib/api/discovery";
import { fetchDashboard, fetchPeakHeatmap } from "@/lib/api/owner-analytics";
import { countNewOrders } from "@/lib/api/owner-back-office";
import { fetchBusinessBookings } from "@/lib/api/owner";
import { openMinutesForWeekday } from "@/lib/calendar-logic";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
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

  const [bookings, hours, newOrders, roster, services] = await Promise.all([
    fetchBusinessBookings(supabase, active.id, bounds).catch(() => []),
    fetchBusinessHours(supabase, active.id).catch(() => []),
    // `null`, not `0`: see `OrdersInboxCard`. A failed count must not report an empty inbox.
    storefront ? countNewOrders(supabase, active.id).catch(() => null) : Promise.resolve(null),
    /*
      For the header's stylist count **and** the setup checklist, which is why it is
      `activeOnly: false` now: "have you added your team?" is answered by the roster
      existing, and an owner who added a stylist and then deactivated them has still added
      one. The header's own count filters back down to the active ones below.

      Decorative either way, so a failed read costs the count and the checklist, not the
      page — and `null` is what tells the checklist it could not be read, so it hides rather
      than telling a staffed salon to go and hire.
    */
    fetchStaff(supabase, active.id, { activeOnly: false }).catch(() => null),
    fetchServices(supabase, active.id, { activeOnly: false }).catch(() => null),
  ]);

  const activeStylists = (roster ?? []).filter((s) => s.isActive).length;

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
      {/*
        First in the column rather than fixed above it — see the note on the component. It
        renders nothing for a listed, set-up salon, which is almost every salon almost always.
      */}
      <SalonReviewStatus
        business={active}
        hasServices={services == null ? null : services.length > 0}
        hasStaff={roster == null ? null : roster.length > 0}
      />

      <div>
        <h1 className="text-display-lg text-ink font-medium">Insights</h1>
        {/*
          `Salon · N active stylists`, the app's own subtitle (`insights_tab.dart:110`). It
          was the salon name alone here, which reads as a label; the count makes it a line
          about the business, and it is the denominator behind the staff leaderboard further
          down the page.
        */}
        <p className="text-caption-sm text-muted">
          {active.name}
          {activeStylists > 0
            ? ` · ${activeStylists} active ${activeStylists === 1 ? "stylist" : "stylists"}`
            : ""}
        </p>
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
