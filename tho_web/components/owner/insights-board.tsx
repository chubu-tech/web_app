import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import {
  OpsDonut,
  PeakHeatmap,
  RadialGauge,
  RetentionWaffle,
  StaffLeaderboard,
} from "@/components/owner/charts";
import { BreakdownTable } from "@/components/owner/breakdown-table";
import {
  DeltaChip,
  InsightCard,
  KpiCard,
  Reading,
  SectionTitle,
} from "@/components/owner/insight-card";
import { TrendChart } from "@/components/owner/trend-chart";
import {
  glanceStats,
  goalFraction,
  goalReading,
  opsReading,
  retentionReading,
  revenuePace,
} from "@/lib/analytics";
import type { DashboardData, Granularity, HeatCell } from "@/lib/types/analytics";
import { GRANULARITIES } from "@/lib/types/analytics";
import { formatNu } from "@/lib/utils";

/**
 * The trends half of Insights — a port of `_glanceSection` / `_trendsSection` / `_trends` in
 * `tho/app/lib/business/insights/insights_tab.dart`.
 *
 * ## This shows five cards the phone app does not
 *
 * `insights_tab.dart` comments out New vs returning, Top services, Staff leaderboard,
 * Completion & no-shows and Peak hours — THO-55, "at the owner's request" — leaving the hero,
 * three KPIs and the monthly goal. Its own comment calls them *"working features expected back,
 * not dead code"* and leaves restore instructions beside each one.
 *
 * They are all here, and the reason is not symmetry. `analytics_dashboard` returns
 * `retention`, `top_services`, `top_staff` and `ops` on **every** call whether anything renders
 * them or not, so the app is already paying for this data and discarding it; and
 * `analytics_peak_heatmap` is an entire RPC that had no caller in either client. A desktop
 * console also has the room a phone screen didn't, which is what the removal was about.
 *
 * ## Order is the argument
 *
 * Today first (elsewhere, ungated), then the four figures, then the charts. The old dashboard
 * opened on a revenue chart, which is the thing an owner can do least about at 9am; and on
 * Basic it opened on a paywall, which is nothing at all.
 */
export function InsightsBoard({
  dash,
  heatCells,
  heatFailed,
  granularity,
  today,
}: {
  dash: DashboardData;
  heatCells: HeatCell[];
  /** The heatmap read failed on its own. One dead card, not a dead page. */
  heatFailed: boolean;
  granularity: Granularity;
  /** Today in the salon's calendar, resolved by the page — see `lib/time.ts`. */
  today: Date;
}) {
  const k = dash.kpis;
  const stats = glanceStats(dash);
  const emptyPeriod = k.revenue === 0 && k.bookings === 0;

  const pace = revenuePace(today, {
    monthToDate: dash.goal.monthToDateRevenue,
    goal: dash.goal.monthlyGoal,
  });
  const fraction = goalFraction(dash.goal);

  return (
    <>
      {stats.length > 0 ? (
        <section className="mb-lg">
          <SectionTitle>At a glance</SectionTitle>
          <dl className="gap-md grid grid-cols-2 desktop:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.key}
                className="border-hairline-soft bg-canvas p-base rounded-md border"
              >
                <dt className="text-caption-sm text-muted mb-xs truncate">{s.label}</dt>
                <dd
                  className={`text-display-sm font-semibold tabular-nums ${
                    s.tone === "good"
                      ? "text-success-text"
                      : s.tone === "bad"
                        ? "text-error-text"
                        : "text-ink"
                  }`}
                >
                  {s.value}
                </dd>
                {s.detail ? (
                  <dd className="text-caption-sm text-muted truncate">{s.detail}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section>
        <SectionTitle>Trends</SectionTitle>

        {/*
          The period lives in the URL, not in component state — reloadable, linkable and
          back-button-correct, the call the calendar made with `?d=&view=` in 3a. Links rather
          than buttons for the same reason: this navigates.
        */}
        <nav aria-label="Period" className="mb-base -mx-base px-base overflow-x-auto">
          <ul className="gap-sm flex">
            {GRANULARITIES.map((g) => {
              const on = g.value === granularity;
              return (
                <li key={g.value}>
                  <Link
                    href={`/business/insights?period=${g.value}`}
                    aria-current={on ? "true" : undefined}
                    className={`text-title inline-flex items-center rounded-full border px-4 py-2 font-medium whitespace-nowrap transition-colors duration-[--duration-fast] ${
                      on
                        ? "bg-ink text-on-primary border-ink"
                        : "border-hairline text-ink hover:bg-surface-soft"
                    }`}
                  >
                    {g.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {emptyPeriod ? (
          <EmptyState
            icon={Icons.insights}
            title="No trends yet"
            message="Complete a few bookings and this fills in."
          />
        ) : (
          <div className="gap-md flex flex-col">
            {/* ------------------------------------------------------- the hero --- */}
            <div className="bg-ink px-base pt-base pb-sm rounded-lg">
              <div className="gap-sm mb-xs flex items-center">
                <span className="text-caption-sm flex-1 font-semibold tracking-wide text-[#9E9E9E] uppercase">
                  Revenue
                </span>
                <DeltaChip now={k.revenue} prev={k.revenuePrev} onDark />
              </div>
              <p className="text-on-primary text-[34px] leading-tight font-extrabold tracking-tight tabular-nums">
                {formatNu(k.revenue)}
              </p>
              <PaceLine
                onTrack={pace.onTrack}
                text={
                  pace.onTrack == null
                    ? `This month: ${formatNu(pace.monthToDate)}`
                    : `On pace for ${formatNu(pace.projected)} · goal ${formatNu(pace.goal ?? 0)}`
                }
              />
              {dash.revenue.length > 0 ? (
                <div className="mt-md">
                  <TrendChart points={dash.revenue} onDark height={172} />
                </div>
              ) : null}
            </div>

            {/* ------------------------------------------------------ three KPIs --- */}
            <div className="gap-sm flex flex-wrap">
              <KpiCard
                label="Bookings"
                value={String(k.bookings)}
                now={k.bookings}
                prev={k.bookingsPrev}
              />
              <KpiCard
                label="Avg ticket"
                value={formatNu(k.avgTicket)}
                now={k.avgTicket}
                prev={k.avgTicketPrev}
              />
              <KpiCard
                label="Utilization"
                value={`${Math.round(k.utilization * 100)}%`}
                now={k.utilization}
                prev={k.utilizationPrev}
                progress={k.utilization}
              />
            </div>

            {/* ----------------------------------------------------- monthly goal --- */}
            <InsightCard title="Monthly goal">
              <div className="gap-base flex flex-wrap items-center">
                <RadialGauge
                  progress={fraction ?? 0}
                  centerValue={fraction == null ? "—" : `${Math.round(fraction * 100)}%`}
                  centerLabel={dash.goal.monthlyGoal == null ? "vs last month" : "of goal"}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-caption-sm text-muted">This month</p>
                  <p className="text-display-sm text-ink font-semibold tabular-nums">
                    {formatNu(dash.goal.monthToDateRevenue)}
                  </p>
                  {dash.goal.monthlyGoal != null ? (
                    <p className="text-body-sm text-muted">
                      Goal {formatNu(dash.goal.monthlyGoal)}
                    </p>
                  ) : null}

                  {dash.topStaff.length > 0 ? (
                    <>
                      <p className="text-caption text-ink mt-md mb-xs font-medium">Top staff</p>
                      <ul className="gap-xxs flex flex-col">
                        {dash.topStaff.slice(0, 3).map((s) => (
                          <li key={s.staffId} className="gap-sm flex items-baseline">
                            <span className="text-body-sm text-ink min-w-0 flex-1 truncate">
                              {s.name}
                            </span>
                            <span className="text-title text-ink font-medium tabular-nums">
                              {formatNu(s.revenue)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              </div>
              {/*
                The hero states the projection; this restates it as work — "6 more bookings
                closes the gap" — because a shortfall in Nu is a worry and a shortfall in cuts
                is a plan.

                **The ticket count is only offered on the monthly view, and that is a fix.** This
                card is always about the calendar month — `goal.monthToDateRevenue` and
                `monthly_goal` both are, whatever the period pills say — but `kpis.avgTicket` is
                scoped to the *selected* period. Dividing a monthly shortfall by a weekly average
                ticket is how the app arrives at "258 more bookings closes the gap" on the weekly
                view, measured on this salon. Passing 0 makes `ticketsToGoal` return null and
                `goalReading` state the shortfall plainly instead, which is the honest sentence at
                every other granularity.
              */}
              <Reading>
                {goalReading(pace, granularity === "monthly" ? k.avgTicket : 0)}
              </Reading>
            </InsightCard>

            {/* ------------------------------------------------ new vs returning --- */}
            <InsightCard title="New vs returning">
              <RetentionWaffle split={dash.retention} />
              <Reading>{retentionReading(dash.retention)}</Reading>
            </InsightCard>

            {/* ------------------------------------------------------ top services --- */}
            <InsightCard>
              <BreakdownTable services={dash.topServices} title="Top services" />
            </InsightCard>

            {/* --------------------------------------------------- staff leaderboard --- */}
            <InsightCard title="Staff leaderboard">
              <StaffLeaderboard staff={dash.topStaff} />
            </InsightCard>

            {/* ------------------------------------------------ completion & no-shows --- */}
            <InsightCard title="Completion & no-shows">
              <OpsDonut ops={dash.ops} />
              <Reading>{opsReading(dash.ops)}</Reading>
            </InsightCard>

            {/* ---------------------------------------------------------- peak hours --- */}
            <InsightCard title="Peak hours">
              {heatFailed ? (
                <p className="text-body-sm text-muted">
                  Peak hours are unavailable right now. Everything else on this page loaded.
                </p>
              ) : (
                <PeakHeatmap cells={heatCells} />
              )}
              <Reading>
                A rolling 90 days, independent of the period above — the question is when the
                shop is busy, not how last month went.
              </Reading>
            </InsightCard>
          </div>
        )}
      </section>
    </>
  );
}

/** The one line inside the ink hero that says where the month is heading. */
function PaceLine({ onTrack, text }: { onTrack: boolean | null; text: string }) {
  const tone =
    onTrack == null ? "text-[#9E9E9E]" : onTrack ? "text-[#5FD08A]" : "text-rausch-disabled";
  const Icon = onTrack == null ? null : onTrack ? Icons.trendUp : Icons.trendDown;
  return (
    <p className={`text-caption-sm mt-xs gap-xs flex items-center ${tone}`}>
      {Icon ? (
        <Icon style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
      ) : null}
      <span className="truncate">{text}</span>
    </p>
  );
}
