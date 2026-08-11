import type { Metadata } from "next";
import { CalendarView, type CalendarViewMode } from "@/components/owner/calendar-view";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { fetchBusinessBookings } from "@/lib/api/owner";
import { fetchBusinessHours } from "@/lib/api/discovery";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { addDays, fromIsoDay, thimphuDayBoundsUtc, thimphuToday, thimphuWeekday } from "@/lib/time";
import type { Booking } from "@/lib/types/booking";

export const metadata: Metadata = { title: "Calendar" };

/**
 * The owner console's home — today's appointment book.
 *
 * **Not Insights, which is the app's first tab.** A phone shell needs a landing tab and
 * puts the numbers there; an owner opening a browser at nine in the morning wants the day.
 * Insights takes `/business/insights` in 3c and this stays the calendar.
 *
 * **The view decides the read**, which is the whole reason the day and mode live in the
 * URL: one day, one week, or the book. Nothing is over-fetched and nothing is fetched
 * twice — `getOwnerContext` is memoised for the request, so the layout's switcher and this
 * page resolve the same salon from one query.
 */
export default async function OwnerCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const raw = await searchParams;
  const one = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // A single `now` for the whole render. The countdown in the header and the NOW rule in
  // the agenda both derive from it, and two clocks would eventually disagree by a minute
  // in a way that looks like a bug.
  const now = new Date();
  const today = thimphuToday(now);
  const day = parseDay(one("d"), today);

  // Week view is Growth-only. Falling back rather than refusing keeps a hand-typed or
  // bookmarked `?view=week` from dead-ending a Basic salon — the segment still carries its
  // lock, so the reason is on screen.
  const requested = parseView(one("view"));
  const view: CalendarViewMode =
    requested === "week" && !hasFeature(active.plan, "weekView") ? "day" : requested;

  const supabase = await createClient();

  const [bookings, hours] = await Promise.all([
    readBookings(supabase, active.id, view, day),
    // A failed hours read costs the `% booked` figure and nothing else — `dayStats`
    // returns a null utilization rather than a wrong one.
    fetchBusinessHours(supabase, active.id).catch(() => []),
  ]);

  return (
    <CalendarView
      business={active}
      view={view}
      day={day}
      today={today}
      now={now}
      bookings={bookings.rows}
      hours={hours}
      listSegment={parseSegment(one("seg"))}
      listCapped={bookings.capped}
    />
  );
}

/**
 * How many rows List mode will load. See `readBookings`.
 *
 * **Raised from 200.** The app loads the book unbounded, so any cap is a divergence — the
 * question is only whether it is a reachable one. At 200 it was: a salon three years in would
 * see a different list in the two clients. At 500 it is not, by a wide margin — the busiest
 * live salon has 56 bookings in total — while the guard that stops a browser being handed
 * thousands of rows for a triage list stays in place.
 *
 * Kept rather than removed because the reasoning behind it never depended on the number: a
 * list whose useful half is the Upcoming tab does not need the whole archive, and history
 * proper belongs to Insights. When it does bite, the view says so out loud.
 */
const LIST_LIMIT = 500;

async function readBookings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  view: CalendarViewMode,
  day: Date,
): Promise<{ rows: Booking[]; capped: boolean }> {
  if (view === "list") {
    // The book, newest first, capped. The app loads it unbounded; a salon with two years
    // of history would be shipping thousands of rows to a browser for a triage list whose
    // useful half is the Upcoming tab. When the cap bites, the view says so out loud
    // rather than quietly looking complete — history proper belongs to 3c's Insights.
    const { from, to } = wideRange();
    const rows = await fetchBusinessBookings(supabase, businessId, { from, to });
    const newestFirst = rows.slice().reverse();
    return {
      rows: newestFirst.slice(0, LIST_LIMIT),
      capped: newestFirst.length > LIST_LIMIT,
    };
  }

  if (view === "week") {
    // The week starts Sunday, matching `groupWeekByDay` and `business_hours.day_of_week`.
    const weekStart = addDays(day, -thimphuWeekday(day));
    const { from } = thimphuDayBoundsUtc(weekStart);
    const { to } = thimphuDayBoundsUtc(addDays(weekStart, 6));
    return { rows: await fetchBusinessBookings(supabase, businessId, { from, to }), capped: false };
  }

  const { from, to } = thimphuDayBoundsUtc(day);
  return { rows: await fetchBusinessBookings(supabase, businessId, { from, to }), capped: false };
}

/**
 * The range List mode reads over.
 *
 * Bounded rather than unbounded so the query can use the `start_ts` index and so a clock
 * skew cannot pull in a row dated in the year 3000. Ten years back covers every salon on
 * the platform — the oldest live booking is from May 2026 — and two years forward is far
 * beyond anything `compute_availability` will offer.
 */
function wideRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getTime());
  from.setUTCFullYear(from.getUTCFullYear() - 10);
  const to = new Date(now.getTime());
  to.setUTCFullYear(to.getUTCFullYear() + 2);
  return { from, to };
}

/** `?d=yyyy-mm-dd`, falling back to today for anything unparseable. */
function parseDay(value: string | undefined, today: Date): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  const day = fromIsoDay(value);
  return Number.isNaN(day.getTime()) ? today : day;
}

function parseView(value: string | undefined): CalendarViewMode {
  return value === "week" || value === "list" ? value : "day";
}

function parseSegment(value: string | undefined): number {
  const n = Number(value);
  return n === 1 || n === 2 ? n : 0;
}
