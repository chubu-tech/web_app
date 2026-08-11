import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";
import { customerName } from "@/lib/types/booking";
import { countdownLabel, dayStats } from "@/lib/calendar-logic";
import type { Booking } from "@/lib/types/booking";
import { formatMinutesOfDay, thimphuMinutesOfDay } from "@/lib/time";
import { formatNu } from "@/lib/utils";

/**
 * "Run my day", at the top of Insights — a port of
 * `tho/app/lib/business/insights/widgets/today_snapshot.dart`.
 *
 * **Deliberately ungated.** Every owner on every plan needs to know what today looks like, and
 * it is built from bookings they can already read — so a Basic salon opens Insights to
 * something useful instead of a paywall. That is the whole reason the app's dashboard was
 * reordered, and it carries over unchanged.
 *
 * Every figure comes from `dayStats` in `lib/calendar-logic.ts`, the same function
 * `TodayHeader` uses on the calendar — so the two pages cannot disagree about which bookings
 * count. `isActiveBooking` excludes cancelled and no-show from all of them, which is why a day
 * with three cancellations reads "0 appointments" rather than "3".
 *
 * **`% booked` is omitted, not zeroed, on a day the salon lists no hours for.** `openMinutes`
 * is null for a closed day — a missing `business_hours` row is how "closed" is spelled — and 0%
 * would call an empty Sunday a wasted one.
 *
 * `now` arrives from the server page rather than being read here, the rule 2d set: the
 * countdown and the calendar's NOW divider have to agree, and two renders reading their own
 * clock eventually won't.
 */
export function TodaySnapshot({
  bookings,
  now,
  openMinutes,
}: {
  bookings: Booking[];
  now: Date;
  openMinutes: number | null;
}) {
  const stats = dayStats(bookings, now, openMinutes);
  const pct = stats.utilizationPct == null ? null : Math.round(stats.utilizationPct * 100);
  const next = stats.nextUp;

  return (
    <section className="border-hairline-soft bg-canvas p-base rounded-lg border">
      <div className="gap-sm mb-md flex items-baseline">
        <h2 className="text-caption-sm text-muted flex-1 font-semibold tracking-wide uppercase">
          Today
        </h2>
        <span className="text-caption-sm text-muted">{thimphuDayLabel(now)}</span>
      </div>

      {next ? (
        <Link
          href={`/business/bookings/${next.id}`}
          className="gap-md hover:bg-surface-soft -mx-sm px-sm py-xs flex items-center rounded-sm"
        >
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-full ${
              isImminent(next, now) ? "bg-rausch/10" : "bg-surface-soft"
            }`}
          >
            <Icons.clock
              className={isImminent(next, now) ? "text-rausch" : "text-muted"}
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-caption-sm text-muted block">
              Next up · {formatMinutesOfDay(thimphuMinutesOfDay(next.startTs))}
            </span>
            <span className="text-title text-ink block truncate font-medium">
              {customerName(next)}
            </span>
            {(next.items ?? []).length > 0 ? (
              <span className="text-body-sm text-muted block truncate">
                {(next.items ?? []).map((i) => i.name).join(", ")}
              </span>
            ) : null}
          </span>
          <span
            className={`text-caption-sm shrink-0 rounded-full px-2 py-1 font-semibold ${
              isImminent(next, now) ? "bg-rausch text-on-primary" : "bg-surface-strong text-body"
            }`}
          >
            {countdownLabel(next.startTs.getTime() - now.getTime())}
          </span>
        </Link>
      ) : (
        <div className="gap-md flex items-center">
          <span className="bg-surface-soft grid size-11 shrink-0 place-items-center rounded-full">
            {stats.appointmentCount > 0 ? (
              <Icons.success
                className="text-success-text"
                style={{ width: IconSize.sm, height: IconSize.sm }}
                aria-hidden
              />
            ) : (
              <Icons.booking
                className="text-muted"
                style={{ width: IconSize.sm, height: IconSize.sm }}
                aria-hidden
              />
            )}
          </span>
          <p className="text-title text-ink font-medium">
            {stats.appointmentCount > 0
              ? "That's everyone for today"
              : "Nothing booked today"}
          </p>
        </div>
      )}

      <dl className="border-hairline-soft divide-hairline-soft mt-base pt-md flex divide-x border-t">
        <Figure
          value={String(stats.appointmentCount)}
          label={stats.appointmentCount === 1 ? "appointment" : "appointments"}
        />
        <Figure value={formatNu(stats.expectedTakings)} label="expected" />
        {pct != null ? <Figure value={`${pct}%`} label="booked" /> : null}
      </dl>
    </section>
  );
}

/**
 * Under an hour out is the only case worth colouring — it is the one that changes what the
 * owner does in the next few minutes.
 */
function isImminent(booking: Booking, now: Date): boolean {
  return (booking.startTs.getTime() - now.getTime()) / 60_000 <= 60;
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-md min-w-0 flex-1 first:pl-0">
      <dd className="text-title text-ink truncate font-semibold tabular-nums">{value}</dd>
      <dt className="text-caption-sm text-muted truncate">{label}</dt>
    </div>
  );
}

/** "Wed 5 Aug" in the salon's own calendar. */
function thimphuDayLabel(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Thimphu",
  }).format(now);
}
