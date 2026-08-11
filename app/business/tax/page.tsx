import type { Metadata } from "next";
import Link from "next/link";
import { LockedTeaser } from "@/components/owner/insight-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { PaywallButton } from "@/components/owner/paywall-button";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchTaxEstimate } from "@/lib/api/owner-back-office";
import { GST_THRESHOLD_NU } from "@/lib/analytics";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { thimphuToday } from "@/lib/time";
import { formatNu } from "@/lib/utils";

export const metadata: Metadata = { title: "Tax estimate" };

/**
 * A year's estimated tax position — a port of
 * `tho/app/lib/business/team/tax_report_screen.dart`.
 *
 * **Pro, enforced in SQL** (`P0001 'tax report requires Pro'`), and drawing a locked card the
 * app doesn't — `TaxReportScreen` shows *"Couldn't load tax estimate"* on every non-Pro salon,
 * which is all of them.
 *
 * Presumptive basis: 15% of turnover is assessable, then the 2026 Bhutan PIT bands. Turnover
 * counts **completed bookings and collected orders**, both bucketed by `Asia/Thimphu` — so the
 * storefront is in the figure, and an order collected just after midnight local belongs to the
 * right year.
 *
 * `estimateIncomeTax` in `lib/analytics.ts` reimplements `private.pit_2026` and is unit-tested
 * against every band boundary. It is not used to *render* this page — the server's figure is what
 * an owner would take to an accountant, so that is what is shown — but it exists so the two can
 * be compared, which is the only way to notice if they ever drift.
 *
 * The disclaimer is upstream's, verbatim. It is the one number in this console with consequences
 * outside the salon.
 */
export default async function OwnerTaxPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  if (!hasFeature(active.plan, "commissions")) {
    return (
      <Shell year={null}>
        <LockedTeaser
          title="See what you are likely to owe"
          message="Turnover, presumptive income tax, the GST threshold and your filing deadline. On Pro."
          action={<PaywallButton feature="commissions" label="See plans" />}
        />
      </Shell>
    );
  }

  const { y } = await searchParams;
  const year = yearFrom(y);
  const supabase = await createClient();
  const estimate = await fetchTaxEstimate(supabase, active.id, year).catch(() => null);

  return (
    <Shell year={year}>
      {estimate == null ? (
        <p className="text-body-sm text-muted">
          Couldn&apos;t load the estimate for {year}. Reload to try again.
        </p>
      ) : (
        <>
          <p className="text-body-sm text-muted mb-base">Presumptive basis · Bhutan 2026 PIT</p>

          <div className="gap-sm mb-sm flex flex-wrap">
            <Stat label="Turnover" value={formatNu(estimate.turnover)} />
            <Stat label="Assessable (15%)" value={formatNu(estimate.assessable)} />
          </div>
          <div className="gap-sm mb-base flex flex-wrap">
            <Stat label="Income tax (est.)" value={formatNu(estimate.incomeTax)} />
            <Stat
              label="Effective rate"
              value={`${(estimate.effectiveRate * 100).toFixed(1)}%`}
            />
          </div>

          <div className="border-hairline-soft bg-canvas p-base gap-md mb-base flex items-center rounded-md border">
            {estimate.gstRequired ? (
              <Icons.info
                className="text-rausch shrink-0"
                style={{ width: IconSize.md, height: IconSize.md }}
                aria-hidden
              />
            ) : (
              <Icons.success
                className="text-muted shrink-0"
                style={{ width: IconSize.md, height: IconSize.md }}
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-title text-ink font-medium">GST</p>
              <p className="text-body-sm text-muted">
                {estimate.gstRequired
                  ? `Registration required · roughly ${formatNu(estimate.gstEstimate)}`
                  : `Not applicable — below ${formatNu(GST_THRESHOLD_NU)} turnover`}
              </p>
            </div>
          </div>

          <div className="border-hairline-soft bg-canvas p-base gap-md mb-lg flex items-center rounded-md border">
            <Icons.booking
              className="text-muted shrink-0"
              style={{ width: IconSize.md, height: IconSize.md }}
              aria-hidden
            />
            <p className="text-title text-ink flex-1 font-medium">Filing deadline</p>
            <p className="text-body-md text-ink">{dayLabel(estimate.filingDeadline)}</p>
          </div>

          <p className="bg-surface-soft p-md text-body-sm text-muted rounded-md">
            Estimate only — confirm with an accountant / DRC before filing.
          </p>
        </>
      )}
    </Shell>
  );
}

function Shell({ year, children }: { year: number | null; children: React.ReactNode }) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-base font-medium">Tax estimate</h1>
      {year != null ? (
        <nav aria-label="Year" className="mb-lg flex items-center justify-between">
          <Link
            href={`/business/tax?y=${year - 1}`}
            aria-label="Previous year"
            className="text-ink hover:bg-surface-soft grid size-11 place-items-center rounded-full"
          >
            <Icons.chevronLeft
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          </Link>
          <span className="text-title text-ink font-medium tabular-nums">{year}</span>
          <Link
            href={`/business/tax?y=${year + 1}`}
            aria-label="Next year"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-hairline-soft bg-canvas p-base min-w-[46%] flex-1 rounded-md border">
      <p className="text-caption-sm text-muted mb-xs truncate">{label}</p>
      <p className="text-display-sm text-ink font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Four digits, and only a plausible one. Falls back to the salon's current year. */
function yearFrom(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isFinite(n) && n >= 2020 && n <= 2100) return n;
  return thimphuToday().getUTCFullYear();
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Thimphu",
  }).format(d);
}
