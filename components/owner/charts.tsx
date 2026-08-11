import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { heatGrid } from "@/lib/analytics";
import type { HeatCell, OpsRates, RetentionSplit, StaffStat } from "@/lib/types/analytics";
import { formatNu } from "@/lib/utils";

/**
 * The five remaining analytics visualisations — gauge, donut, waffle, heatmap, leaderboard —
 * ported from `tho/app/lib/business/insights/widgets/`.
 *
 * Together with `trend-chart.tsx` these replace `fl_chart` entirely: **each is built from the
 * primitive that actually suits it**, not from one abstraction stretched five ways. Two arcs
 * are SVG because an arc is a path; two grids are CSS grid because a grid is a grid; the
 * leaderboard is flex rows because it is a table of numbers with a bar behind them. All server
 * components, so every figure is in the first paint.
 *
 * The palette rule from `chart_theme.dart` holds throughout: **coral is the one accent, and a
 * bad outcome never wears it.** Completed is `success-text`, no-shows are `error-text`,
 * cancelled is `border-strong`.
 */

/* ------------------------------------------------------------- radial gauge --- */

/**
 * The monthly-goal ring.
 *
 * `stroke-dasharray` on a circle, rotated so it starts at twelve o'clock — one element for the
 * track and one for the arc, which is the whole implementation. `progress` above 1 is clamped:
 * a salon at 130% of goal should read as a full ring, not wrap around and look like 30%.
 *
 * `centerValue` is "—" rather than "0%" when there is no goal, because a goal of nothing and
 * no goal at all are the same state (`businesses.monthly_revenue_goal` stores 0 as null) and
 * neither is 0% of anything.
 */
export function RadialGauge({
  progress,
  centerValue,
  centerLabel,
  size = 132,
}: {
  progress: number;
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const stroke = 12;
  const r = (100 - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.min(Math.max(progress, 0), 1) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${centerValue} ${centerLabel}`}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke="var(--color-surface-strong)"
          strokeWidth={stroke}
        />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke="var(--color-rausch)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-display-sm text-ink font-semibold tabular-nums">{centerValue}</p>
          <p className="text-caption-sm text-muted">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- ops donut --- */

/**
 * Completion, no-shows and cancellations as one ring.
 *
 * Three arcs on one circle, each offset by the ones before it — the same
 * `stroke-dasharray` trick as the gauge, with `stroke-dashoffset` doing the stacking. A donut
 * rather than a bar because the question is what proportion of a whole each outcome is, and the
 * total in the middle is the number an owner quotes.
 */
export function OpsDonut({ ops }: { ops: OpsRates }) {
  const total = ops.completed + ops.noShow + ops.cancelled;
  const stroke = 14;
  const r = (100 - stroke) / 2;
  const c = 2 * Math.PI * r;

  const slices = [
    { key: "completed", value: ops.completed, colour: "var(--color-success-text)", label: "Completed" },
    { key: "noShow", value: ops.noShow, colour: "var(--color-error-text)", label: "No-shows" },
    { key: "cancelled", value: ops.cancelled, colour: "var(--color-border-strong)", label: "Cancelled" },
  ];

  let offset = 0;
  return (
    <div className="gap-base flex flex-wrap items-center">
      <div className="relative size-[132px] shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle
            cx={50}
            cy={50}
            r={r}
            fill="none"
            stroke="var(--color-surface-strong)"
            strokeWidth={stroke}
          />
          {total > 0
            ? slices.map((s) => {
                const len = (s.value / total) * c;
                const el = (
                  <circle
                    key={s.key}
                    cx={50}
                    cy={50}
                    r={r}
                    fill="none"
                    stroke={s.colour}
                    strokeWidth={stroke}
                    strokeDasharray={`${len} ${c - len}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })
            : null}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-display-sm text-ink font-semibold tabular-nums">{total}</p>
            <p className="text-caption-sm text-muted">bookings</p>
          </div>
        </div>
      </div>
      <dl className="gap-sm min-w-0 flex-1">
        {slices.map((s) => (
          <div key={s.key} className="gap-sm flex items-center">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: s.colour }}
              aria-hidden
            />
            <dt className="text-body-sm text-body min-w-0 flex-1">{s.label}</dt>
            <dd className="text-title text-ink font-medium tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------ retention waffle --- */

/**
 * New vs returning, as 100 squares.
 *
 * A waffle rather than a two-slice pie: at these proportions a pie is two wedges and reading
 * it means estimating an angle, where a waffle *is* the percentage — you can count it. The
 * returning tiles take the accent, because repeat custom is the number the business runs on.
 *
 * The rounding is deliberate and stated: `round` can produce 99 or 101 tiles for a split like
 * 1/3, so the returning count is rounded and the new count is the remainder. The two always
 * sum to 100 and the label carries the exact figure.
 */
export function RetentionWaffle({ split }: { split: RetentionSplit }) {
  const total = split.newCustomers + split.returningCustomers;
  const returningTiles =
    total === 0 ? 0 : Math.round((split.returningCustomers / total) * 100);

  return (
    <div>
      <div
        className="grid grid-cols-10 gap-[3px]"
        role="img"
        aria-label={`${split.returningCustomers} returning and ${split.newCustomers} new customers`}
      >
        {Array.from({ length: 100 }, (_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-[2px] ${
              i < returningTiles ? "bg-rausch" : "bg-surface-strong"
            }`}
          />
        ))}
      </div>
      <dl className="gap-base mt-md flex flex-wrap">
        <div className="gap-sm flex items-center">
          <span className="bg-rausch size-3 rounded-full" aria-hidden />
          <dt className="text-body-sm text-body">Returning</dt>
          <dd className="text-title text-ink font-medium tabular-nums">
            {split.returningCustomers}
          </dd>
        </div>
        <div className="gap-sm flex items-center">
          <span className="bg-surface-strong size-3 rounded-full" aria-hidden />
          <dt className="text-body-sm text-body">New</dt>
          <dd className="text-title text-ink font-medium tabular-nums">{split.newCustomers}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ----------------------------------------------------------------- heatmap --- */

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * When the shop is busy — 7 days × 24 hours.
 *
 * **A zero cell stays canvas white, not the cold end of the ramp.** That is the one thing the
 * Dart is emphatic about and the easiest to get wrong: on a single-hue ramp, "no bookings ever"
 * and "one booking" would be two barely-different pinks, and a salon closed on Sunday would
 * look faintly busy. So no heat at all is *no colour at all*, and every non-zero value lerps
 * `rausch-disabled → rausch-active`.
 *
 * 24 columns do not fit a phone, so the grid scrolls **inside its own container** — the body
 * never scrolls sideways, which is the rule every route in this app is checked against.
 */
export function PeakHeatmap({ cells }: { cells: HeatCell[] }) {
  if (cells.length === 0) {
    return (
      <EmptyState
        icon={Icons.heatmap}
        title="No peak-hour data yet"
        message="This heatmap fills in as bookings accumulate."
      />
    );
  }
  const { rows, max } = heatGrid(cells);

  return (
    <div>
      <div className="-mx-base px-base overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="mb-xs flex pl-[34px]">
            {[0, 6, 12, 18].map((h) => (
              <span key={h} className="text-caption-sm text-muted flex-1">
                {h}h
              </span>
            ))}
          </div>
          {rows.map((row, dow) => (
            <div key={dow} className="mb-[3px] flex items-center">
              <span className="text-caption-sm text-muted w-[34px] shrink-0">
                {DOW_SHORT[dow]}
              </span>
              <div className="gap-[3px] flex flex-1">
                {row.map((count, hour) => (
                  <span
                    key={hour}
                    className="rounded-[2px]"
                    style={{
                      flex: 1,
                      height: 14,
                      backgroundColor: heatColour(count, max),
                    }}
                    title={`${DOW_SHORT[dow]} ${String(hour).padStart(2, "0")}:00 — ${count} ${
                      count === 1 ? "booking" : "bookings"
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="gap-xs mt-sm flex items-center justify-end">
        <span className="text-caption-sm text-muted">Less</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="border-hairline-soft size-3 rounded-[2px] border"
            style={{ backgroundColor: i === 0 ? "var(--color-canvas)" : heatColour(i, 4) }}
            aria-hidden
          />
        ))}
        <span className="text-caption-sm text-muted">More</span>
      </div>
    </div>
  );
}

/**
 * `rausch-disabled` (#ffd1da) → `rausch-active` (#e00b41), and **white at zero**.
 *
 * Interpolated in sRGB, which is what `Color.lerp` does in Flutter — a perceptually-even space
 * would be better colour science and a different picture from the same data, so the two clients
 * would disagree about how busy a Tuesday looks.
 */
function heatColour(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "var(--color-canvas)";
  const t = Math.min(value / max, 1);
  const from = [255, 209, 218];
  const to = [224, 11, 65];
  const mix = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `rgb(${mix[0]} ${mix[1]} ${mix[2]})`;
}

/* ------------------------------------------------------------- leaderboard --- */

/**
 * Who brought the money in.
 *
 * A bar behind each row rather than beside it, so the name stays readable at 390px and the
 * share is background information — which is the right weight for it: the figure is the point,
 * the bar is the comparison.
 *
 * `avgRating` is shown only when the member has one. A stylist with no rated bookings is not a
 * zero-star stylist.
 */
export function StaffLeaderboard({ staff }: { staff: StaffStat[] }) {
  if (staff.length === 0) {
    return (
      <p className="text-body-sm text-muted">
        No completed bookings in this period, so there is nothing to rank.
      </p>
    );
  }
  return (
    <ol className="gap-sm flex flex-col">
      {staff.map((s, i) => (
        <li key={s.staffId} className="relative overflow-hidden rounded-sm">
          <span
            className="bg-rausch/10 absolute inset-y-0 left-0"
            style={{ width: `${Math.min(Math.max(s.pct, 0), 1) * 100}%` }}
            aria-hidden
          />
          <div className="px-sm py-sm gap-sm relative flex items-center">
            <span className="text-caption-sm text-muted w-4 shrink-0 tabular-nums">{i + 1}</span>
            <span className="text-body-md text-ink min-w-0 flex-1 truncate">{s.name}</span>
            {s.avgRating != null ? (
              <span className="text-caption-sm text-muted gap-xxs flex shrink-0 items-center tabular-nums">
                <Icons.star
                  className="text-star fill-current"
                  style={{ width: 12, height: 12 }}
                  aria-hidden
                />
                {s.avgRating.toFixed(1)}
              </span>
            ) : null}
            <span className="text-title text-ink shrink-0 font-medium tabular-nums">
              {formatNu(s.revenue)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
