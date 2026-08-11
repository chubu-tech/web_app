import { Icons, IconSize } from "@/components/ui/icons";
import { deltaPct } from "@/lib/analytics";

/**
 * The small shared pieces every analytics card is built from — a port of
 * `tho/app/lib/business/insights/widgets/{insight_card,kpi_card,delta_chip,locked_teaser}.dart`
 * and the private `_SectionTitle` / `_Reading` in `insights_tab.dart`.
 *
 * All server components. Nothing here is interactive, and nothing animates: the app's
 * `CountUp` and `Reveal` stagger are motion for a screen you pull down to refresh, and on a
 * page that server-renders in one pass they would only delay the number an owner opened the
 * page to read. `InsightMotion` still governs the two things that *are* client-side — the
 * period switch and the chart tooltip.
 *
 * **`ChartTheme` in one place.** The app has a `chart_theme.dart` deriving every chart colour
 * from `AppColors`; here the same palette is Tailwind tokens from `app/globals.css`, and the
 * rules travel with them:
 *
 * - Coral (`rausch`) is the **one** accent — trend line, gauge arc, share bars, the hot end of
 *   the heatmap, the "returning" tiles.
 * - **A bad outcome never wears the brand coral.** `success-text` for completed,
 *   `error-text` for no-shows, `border-strong` for cancelled. Status colours are reserved.
 * - Numbers are `tabular-nums` everywhere, so a column of figures doesn't jitter.
 */

/** A titled white card. `title` is optional — the breakdown table owns its own header row. */
export function InsightCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-hairline-soft bg-canvas p-base rounded-md border">
      {title ? (
        <h3 className="text-caption-sm text-muted mb-md font-semibold tracking-wide uppercase">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

/** A heading over a group of cards. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-display-sm text-ink mb-sm font-semibold">{children}</h2>;
}

/**
 * The sentence under a chart that says what the chart means.
 *
 * A percentage only means something next to what it was, or what it implies — so every chart
 * that could be misread carries one of these, and the wording is in `lib/analytics.ts` where
 * it can be tested.
 */
export function Reading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-md gap-sm text-body-sm text-body flex items-start">
      <Icons.sparkle
        className="text-muted mt-[2px] shrink-0"
        style={{ width: IconSize.xxs, height: IconSize.xxs }}
        aria-hidden
      />
      <span>{children}</span>
    </p>
  );
}

/**
 * A period-over-period change.
 *
 * Renders **nothing** when there is no previous figure to divide by — `deltaPct` returns null
 * for a zero base, and "+∞%" or a bare "0%" would both be lies about a salon's first month.
 * `onDark` restyles it for the ink hero.
 */
export function DeltaChip({
  now,
  prev,
  onDark = false,
}: {
  now: number;
  prev: number;
  onDark?: boolean;
}) {
  const pct = deltaPct(now, prev);
  if (pct == null) return null;
  const up = pct >= 0;
  const Icon = up ? Icons.trendUp : Icons.trendDown;
  const tone = onDark
    ? up
      ? "text-[#5FD08A]"
      : "text-rausch-disabled"
    : up
      ? "text-success-text bg-success-soft"
      : "text-error-text bg-error-soft";
  return (
    <span
      className={`gap-xxs text-caption-sm inline-flex items-center rounded-full px-2 py-[2px] font-semibold tabular-nums ${tone}`}
    >
      <Icon style={{ width: 12, height: 12 }} aria-hidden />
      {up ? "+" : ""}
      {Math.round(pct * 100)}%
    </span>
  );
}

/**
 * One of the three figures beside the hero.
 *
 * `progress` draws a thin track under the value — used only for utilisation, the one KPI that
 * is a fraction of something rather than a total.
 */
export function KpiCard({
  label,
  value,
  now,
  prev,
  progress,
}: {
  label: string;
  value: string;
  now: number;
  prev: number;
  progress?: number;
}) {
  return (
    <div className="border-hairline-soft bg-canvas p-md min-w-0 flex-1 rounded-md border">
      <div className="gap-xs mb-xs flex items-start">
        <span className="text-caption-sm text-muted min-w-0 flex-1 truncate">{label}</span>
        <DeltaChip now={now} prev={prev} />
      </div>
      <p className="text-display-sm text-ink font-semibold tabular-nums">{value}</p>
      {progress != null ? (
        <div
          className="bg-surface-strong mt-sm h-1 overflow-hidden rounded-full"
          role="presentation"
        >
          <div
            className="bg-rausch h-full rounded-full"
            style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * What a Basic owner sees where the trends would be.
 *
 * A teaser rather than a bare lock: it names the four things that are behind it, because
 * "upgrade to see analytics" tells an owner nothing about whether it is worth Nu 300 a month.
 * `action` is the paywall trigger, which has to be a client component — hence a slot.
 */
export function LockedTeaser({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: React.ReactNode;
}) {
  return (
    <section className="border-hairline-soft bg-surface-soft p-lg gap-md flex flex-col items-start rounded-md border">
      <Icons.locked
        className="text-muted"
        style={{ width: IconSize.xl, height: IconSize.xl }}
        aria-hidden
      />
      <h2 className="text-display-sm text-ink font-semibold">{title}</h2>
      <p className="text-body-sm text-muted max-w-[46ch]">{message}</p>
      {action}
    </section>
  );
}
