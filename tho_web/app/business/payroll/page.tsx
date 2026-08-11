import type { Metadata } from "next";
import Link from "next/link";
import { LockedTeaser } from "@/components/owner/insight-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { PaywallButton } from "@/components/owner/paywall-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchPayroll } from "@/lib/api/owner-back-office";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { thimphuToday } from "@/lib/time";
import { formatNu } from "@/lib/utils";

export const metadata: Metadata = { title: "Payroll" };

/**
 * Per-stylist pay for a month — a port of
 * `tho/app/lib/business/team/payroll_screen.dart`.
 *
 * **Pro, and enforced in SQL**: `payroll_report` raises `P0001 'payroll requires Pro'` for any
 * other plan. Unlike Insights and Loyalty, the gate here is real on both sides.
 *
 * **This page draws a locked card the app doesn't.** `PayrollScreen` has no plan check, so on
 * anything but Pro it calls the RPC, catches the raise, and shows *"Couldn't load payroll"* with
 * a Retry — a plan limit presented as a network fault. No salon on this platform is Pro, so that
 * is what every owner sees in the app today.
 *
 * The arithmetic is the server's: `round(completed revenue × commission_pct / 100, 2) +
 * base_salary_nu`. Both inputs live on `staff_members`, whose pay columns left the owner's UPDATE
 * grant in `20260805000001` and are reachable only through `set_staff_pay` — which is itself
 * Pro-gated. So an owner who can read this page is an owner who could set the rates.
 *
 * The month rides in `?m=YYYY-MM`, so a particular month is linkable and the arrows are plain
 * links rather than state.
 */
export default async function OwnerPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  if (!hasFeature(active.plan, "commissions")) {
    return (
      <Shell month={null}>
        <LockedTeaser
          title="Run payroll from your own numbers"
          message="Commission and base pay per stylist, worked out from completed bookings. On Pro."
          action={<PaywallButton feature="commissions" label="See plans" />}
        />
      </Shell>
    );
  }

  const { m } = await searchParams;
  const month = monthFrom(m);
  // Half-open, as the RPC compares: `>= from` and `< to`, so a month is the 1st to the 1st.
  const from = new Date(Date.UTC(month.year, month.month - 1, 1));
  const to = new Date(Date.UTC(month.year, month.month, 1));

  const supabase = await createClient();
  const rows = await fetchPayroll(supabase, active.id, from, to).catch(() => null);
  const total = (rows ?? []).reduce((sum, r) => sum + r.totalPay, 0);

  return (
    <Shell month={month}>
      {rows == null ? (
        <p className="text-body-sm text-muted">
          Couldn&apos;t load payroll for this month. Reload to try again.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Icons.payroll}
          title="No payroll for this period"
          message="Completed bookings in this month will show up here."
        />
      ) : (
        <>
          <div className="bg-ink p-base mb-md rounded-lg">
            <p className="text-caption-sm text-on-primary/70">Total pay this period</p>
            <p className="text-on-primary text-[34px] leading-tight font-extrabold tabular-nums">
              {formatNu(total)}
            </p>
          </div>

          <ul className="gap-md flex flex-col">
            {rows.map((r) => (
              <li
                key={r.staffMemberId}
                className="border-hairline-soft bg-canvas p-base rounded-md border"
              >
                <p className="text-title text-ink font-medium">{r.displayName}</p>
                <dl className="text-body-sm text-muted mt-xs gap-xxs flex flex-col">
                  <div className="gap-sm flex">
                    <dt className="flex-1">
                      {r.completedBookings}{" "}
                      {r.completedBookings === 1 ? "completed booking" : "completed bookings"}
                    </dt>
                    <dd className="tabular-nums">{formatNu(r.serviceRevenue)}</dd>
                  </div>
                  <div className="gap-sm flex">
                    {/* `String(10)` is "10" and `String(10.5)` is "10.5", so JS already does
                        what the Dart's `_pct` had to strip a trailing ".0" for. */}
                    <dt className="flex-1">Commission at {r.commissionPct}%</dt>
                    <dd className="tabular-nums">{formatNu(r.commission)}</dd>
                  </div>
                  <div className="gap-sm flex">
                    <dt className="flex-1">Base salary</dt>
                    <dd className="tabular-nums">{formatNu(r.baseSalaryNu)}</dd>
                  </div>
                </dl>
                <div className="border-hairline-soft mt-sm pt-sm gap-sm flex items-baseline border-t">
                  <span className="text-title text-ink flex-1 font-medium">Total pay</span>
                  <span className="text-display-sm text-ink font-semibold tabular-nums">
                    {formatNu(r.totalPay)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  );
}

function Shell({
  month,
  children,
}: {
  month: { year: number; month: number } | null;
  children: React.ReactNode;
}) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-base font-medium">Payroll</h1>
      {month ? (
        <nav aria-label="Month" className="mb-lg flex items-center justify-between">
          <Link
            href={`/business/payroll?m=${isoMonth(shift(month, -1))}`}
            aria-label="Previous month"
            className="text-ink hover:bg-surface-soft grid size-11 place-items-center rounded-full"
          >
            <Icons.chevronLeft
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          </Link>
          <span className="text-title text-ink font-medium">{monthLabel(month)}</span>
          <Link
            href={`/business/payroll?m=${isoMonth(shift(month, 1))}`}
            aria-label="Next month"
            className="text-ink hover:bg-surface-soft grid size-11 place-items-center rounded-full"
          >
            <Icons.chevronRight
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          </Link>
        </nav>
      ) : null}
      {children}
    </div>
  );
}

/** `YYYY-MM`, falling back to the salon's current month. */
function monthFrom(raw: string | undefined): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(raw ?? "");
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const today = thimphuToday();
  return { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
}

function shift({ year, month }: { year: number; month: number }, by: number) {
  const zero = year * 12 + (month - 1) + by;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

function isoMonth({ year, month }: { year: number; month: number }): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel({ year, month }: { year: number; month: number }): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}
