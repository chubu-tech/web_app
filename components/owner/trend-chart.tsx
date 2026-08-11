import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import type { TrendPoint } from "@/lib/types/analytics";
import { formatNu } from "@/lib/utils";

/**
 * The revenue sparkline — a port of
 * `tho/app/lib/business/insights/widgets/revenue_trend_chart.dart`.
 *
 * The app draws it with `fl_chart`; this is hand-rolled SVG, and **3c adds no charting
 * dependency**. Six visualisations is not enough to justify one, an SVG `path` is fewer bytes
 * than any library's runtime, and this way the chart server-renders — an owner opening
 * Insights sees the line in the first paint rather than after a hydration.
 *
 * What carried over from the Dart, deliberately:
 *
 * - **A curve, not a polyline.** `curveSmoothness: 0.3` becomes a Catmull-Rom-to-Bézier pass
 *   with the same tension, so the shape matches the app's.
 * - **A dot on the latest bucket only.** `checkToShowDot: spot.x == lastX` — a dot on every
 *   point turns a trend into a scatter, and the one that matters is "where are we now".
 * - **Coral → transparent fill**, `0.22` opacity normally and `0.32` on the ink hero.
 * - **`maxY` is the peak times 1.2**, so the line never touches the top edge.
 * - **Labels every `ceil(n / 5)` buckets** — five is what fits at 390px, and the interval is
 *   derived rather than fixed so a 90-day daily series and a 12-month one both read.
 *
 * What did not: the touch tooltip. `fl_chart` gets one for free from a gesture recogniser; the
 * web equivalent is `<title>` inside each hover target, which every browser and screen reader
 * already knows how to present, and which needs no JavaScript at all.
 */

/** The drawing box. The SVG scales to its container; these are just the coordinate units. */
const W = 600;
const H = 180;
const PAD_X = 4;
const PAD_BOTTOM = 22;

export function TrendChart({
  points,
  onDark = false,
  height = 180,
}: {
  points: TrendPoint[];
  onDark?: boolean;
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon={Icons.chartLine}
        title="No revenue yet"
        message="Complete a few bookings to see your trend."
      />
    );
  }

  const peak = Math.max(...points.map((p) => p.revenue));
  const maxY = peak <= 0 ? 1 : peak * 1.2;
  const plotH = H - PAD_BOTTOM;
  const usableW = W - PAD_X * 2;

  // A single bucket has no width to spread across, so it sits in the middle rather than at
  // x = 0, where half the dot would be clipped by the viewBox.
  const xAt = (i: number) =>
    points.length === 1 ? W / 2 : PAD_X + (i / (points.length - 1)) * usableW;
  const yAt = (v: number) => plotH - (v / maxY) * plotH;

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.revenue) }));
  const line = smoothPath(coords);
  // Closing down to the baseline and back is what makes the same path usable as a fill.
  const area = `${line} L ${coords[coords.length - 1].x} ${plotH} L ${coords[0].x} ${plotH} Z`;

  const gridColor = onDark ? "rgba(255,255,255,0.08)" : "var(--color-hairline-soft)";
  const labelColor = onDark ? "#9E9E9E" : "var(--color-muted)";
  const dotRing = onDark ? "var(--color-ink)" : "var(--color-canvas)";
  const fillTop = onDark ? 0.32 : 0.22;
  const gradientId = onDark ? "trendFillDark" : "trendFill";

  const step = Math.min(Math.max(Math.ceil(points.length / 5), 1), points.length);
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height, width: "100%", display: "block" }}
      role="img"
      aria-label={`Revenue trend across ${points.length} ${
        points.length === 1 ? "period" : "periods"
      }, peaking at ${formatNu(peak)}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-rausch)" stopOpacity={fillTop} />
          <stop offset="100%" stopColor="var(--color-rausch)" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Four horizontal rules and no vertical ones, matching `drawVerticalLine: false`. */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={0}
          x2={W}
          y1={plotH * t}
          y2={plotH * t}
          stroke={gridColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-rausch)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* The "now" marker: coral ringed by the card surface, so it reads on either. */}
      <circle cx={last.x} cy={last.y} r={5.5} fill={dotRing} />
      <circle cx={last.x} cy={last.y} r={4} fill="var(--color-rausch)" />

      {/*
        One invisible hover target per bucket, each carrying its own `<title>`. This is the
        whole tooltip: no listener, no state, no hydration — and a screen reader reads the
        titles as a list of values, which `fl_chart`'s gesture tooltip cannot offer at all.
      */}
      {coords.map((c, i) => (
        <rect
          key={i}
          x={c.x - usableW / Math.max(points.length * 2, 1)}
          y={0}
          width={usableW / Math.max(points.length, 1)}
          height={plotH}
          fill="transparent"
        >
          <title>{`${bucketLabel(points[i].bucketStart)} · ${formatNu(points[i].revenue)}`}</title>
        </rect>
      ))}

      {points.map((p, i) =>
        i % step === 0 ? (
          <text
            key={i}
            x={xAt(i)}
            y={H - 6}
            fill={labelColor}
            fontSize={11}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
          >
            {bucketLabel(p.bucketStart)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** `d/M`, the app's own axis format — short enough that five fit on a phone. */
function bucketLabel(d: Date): string {
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/**
 * A smooth path through the points, at the same tension as `fl_chart`'s
 * `curveSmoothness: 0.3`.
 *
 * Each segment's control points sit 0.3 of the way along the vector between the neighbours on
 * either side — the standard Catmull-Rom → cubic conversion. It is monotonic enough for
 * revenue: the curve can overshoot slightly between two very different buckets, which is what
 * the app's chart does too, and clamping it would make the two platforms draw different
 * shapes from the same numbers.
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const t = 0.3;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * (t / 0.5);
    const c1y = p1.y + ((p2.y - p0.y) / 6) * (t / 0.5);
    const c2x = p2.x - ((p3.x - p1.x) / 6) * (t / 0.5);
    const c2y = p2.y - ((p3.y - p1.y) / 6) * (t / 0.5);
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

const round = (n: number) => Math.round(n * 100) / 100;
