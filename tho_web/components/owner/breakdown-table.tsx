"use client";

import { useState } from "react";
import type { ServiceStat } from "@/lib/types/analytics";
import { formatNu } from "@/lib/utils";

/**
 * Top services — a port of
 * `tho/app/lib/business/insights/widgets/breakdown_table.dart`.
 *
 * **The only chart here that is a client component**, and only because of one toggle. The RPC
 * ships both `revenue` and `bookings` for every row precisely so the re-sort is local: there
 * is no second fetch, no loading state, and the numbers cannot disagree with themselves
 * between the two views.
 *
 * The two orderings answer different questions and an owner needs both. By revenue: what pays
 * for the shop. By bookings: what fills the chairs. A Nu 3,000 colour and twenty Nu 300 cuts
 * are the same money and a completely different day, and a table sorted one way hides that.
 *
 * The header carries the toggle, which is why the card wrapping this one passes no `title` —
 * a card heading plus a header row would put the control on a second line for no reason.
 */
export function BreakdownTable({
  services,
  title,
}: {
  services: ServiceStat[];
  title: string;
}) {
  const [by, setBy] = useState<"revenue" | "bookings">("revenue");

  if (services.length === 0) {
    return (
      <p className="text-body-sm text-muted">
        No completed bookings in this period, so there is nothing to break down.
      </p>
    );
  }

  const rows = [...services].sort((a, b) =>
    by === "revenue" ? b.revenue - a.revenue : b.bookings - a.bookings,
  );
  // The share bar is relative to the biggest row *in the current ordering*, not to the
  // period's total: `pct` is a revenue share, so re-sorting by bookings would otherwise draw
  // bars that contradict the order they are in.
  const peak = Math.max(...rows.map((r) => (by === "revenue" ? r.revenue : r.bookings)), 1);

  return (
    <div>
      <div className="gap-sm mb-md flex items-center">
        <h3 className="text-caption-sm text-muted flex-1 font-semibold tracking-wide uppercase">
          {title}
        </h3>
        <div
          className="bg-surface-soft p-xxs flex rounded-full"
          role="group"
          aria-label="Order by"
        >
          {(["revenue", "bookings"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setBy(k)}
              aria-pressed={by === k}
              className={`text-caption-sm rounded-full px-3 py-1 font-medium transition-colors duration-[var(--duration-fast)] ${
                by === k ? "bg-canvas text-ink shadow-sm" : "text-muted"
              }`}
            >
              {k === "revenue" ? "Revenue" : "Bookings"}
            </button>
          ))}
        </div>
      </div>

      <ol className="gap-xs flex flex-col">
        {rows.map((s) => {
          const value = by === "revenue" ? s.revenue : s.bookings;
          return (
            <li key={s.serviceId} className="relative overflow-hidden rounded-sm">
              <span
                className="bg-rausch/10 absolute inset-y-0 left-0"
                style={{ width: `${(value / peak) * 100}%` }}
                aria-hidden
              />
              <div className="px-sm py-sm gap-sm relative flex items-center">
                <span className="text-body-md text-ink min-w-0 flex-1 truncate">{s.name}</span>
                <span className="text-caption-sm text-muted shrink-0 tabular-nums">
                  {by === "revenue"
                    ? `${s.bookings} ${s.bookings === 1 ? "booking" : "bookings"}`
                    : formatNu(s.revenue)}
                </span>
                <span className="text-title text-ink w-20 shrink-0 text-right font-medium tabular-nums">
                  {by === "revenue" ? formatNu(s.revenue) : s.bookings}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
