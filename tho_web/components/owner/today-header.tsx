import { countdownLabel, dayStats } from "@/lib/calendar-logic";
import type { Booking } from "@/lib/types/booking";
import { formatNu } from "@/lib/utils";
import { customerName } from "./owner-booking-card";

/**
 * The day's four figures, over the agenda — a port of
 * `tho/app/lib/business/calendar/today_header.dart`.
 *
 * Every number comes from `dayStats` in `lib/calendar-logic.ts`, which was ported from the
 * app's `calendar_logic.dart` in **Phase 1** and has had 23 tests and no consumer since.
 * This is what it was for. Nothing is recomputed here, so the header and the rows below it
 * cannot disagree about which bookings count — `isActiveBooking` excludes cancelled and
 * no-show from all four, which is why a day with three cancellations reads "0
 * appointments" rather than "3".
 *
 * **`% booked` is omitted, not zeroed, when the salon lists no hours for that weekday.**
 * `openMinutes` is `null` for a closed day — Norzin has no `business_hours` row for Sunday,
 * which is how "closed" is spelled in that table — and 0% would claim an empty Sunday was
 * a wasted one. `dayStats` returns `utilizationPct: null` for the same reason.
 *
 * `now` is handed in from the server page rather than read here, the rule 2d set: the
 * countdown and the agenda's NOW divider must agree, and two renders reading their own
 * clock would eventually not.
 */
export function TodayHeader({
  bookings,
  now,
  openMinutes,
}: {
  bookings: Booking[];
  now: Date;
  /** Total open minutes for this weekday, or null when the salon is closed. */
  openMinutes: number | null;
}) {
  const stats = dayStats(bookings, now, openMinutes);
  const pct =
    stats.utilizationPct == null ? null : Math.round(stats.utilizationPct * 100);

  return (
    <dl className="border-hairline-soft bg-surface-soft divide-hairline-soft mb-base flex divide-x rounded-md border">
      <Cell
        label={stats.appointmentCount === 1 ? "appointment" : "appointments"}
        value={String(stats.appointmentCount)}
      />
      <Cell
        label="next up"
        value={
          stats.nextUp
            ? customerName(stats.nextUp)
            : stats.appointmentCount > 0
              ? "Nothing left"
              : "—"
        }
        sub={
          stats.nextUp
            ? countdownLabel(stats.nextUp.startTs.getTime() - now.getTime())
            : undefined
        }
      />
      <Cell label="expected" value={formatNu(stats.expectedTakings)} />
      {pct != null ? <Cell label="% booked" value={`${pct}%`} /> : null}
    </dl>
  );
}

function Cell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="p-md min-w-0 flex-1">
      <dd className="text-title text-ink truncate font-semibold tabular-nums">{value}</dd>
      <dt className="text-caption-sm text-muted truncate">{sub ?? label}</dt>
    </div>
  );
}
