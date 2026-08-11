"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { groupWeekByDay, openMinutesForWeekday, perDayCounts } from "@/lib/calendar-logic";
import { hasFeature } from "@/lib/entitlements";
import { addDays, thimphuWeekday, toIsoDay } from "@/lib/time";
import { bookingTab, type Booking, type WorkingHour } from "@/lib/types/booking";
import type { Business } from "@/lib/types/salon";
import { cn } from "@/lib/utils";
import { OwnerBookingCard } from "./owner-booking-card";
import { PaywallSheet } from "./paywall-sheet";
import { TodayHeader } from "./today-header";

/**
 * The owner's appointment book — a port of
 * `tho/app/lib/business/calendar/calendar_tab.dart`.
 *
 * **The selected day and view live in the URL**, not in `useState`. That is a deliberate
 * divergence: the app loses both the moment you switch tabs, whereas
 * `/business?d=2026-08-05&view=week` survives a reload, goes in a message to a colleague,
 * and makes the browser's back button mean what it looks like it means. Same reasoning as
 * Discover's filters, and `salon-filters.ts`'s `fromParams`/`toParams` is the pattern.
 *
 * It also means **the server does the fetching for whichever view is asked for** — one day,
 * one week, or the whole book — instead of this component holding three lists and deciding
 * which is stale. There is no client-side data loading here at all.
 *
 * **Week view is a Growth feature** (`Feature.weekView`). The segment stays pressable and
 * carries a lock: pressing it opens the paywall rather than switching, which is what
 * `_setMode` does in the Dart. Live on both sides — the seeded owner's Norzin is on growth
 * and their other eight salons are on basic.
 */

export type CalendarViewMode = "day" | "week" | "list";

export function CalendarView({
  business,
  view,
  day,
  today,
  now,
  bookings,
  hours,
  listSegment,
  listCapped,
}: {
  business: Business;
  view: CalendarViewMode;
  /** The selected Thimphu day, as a UTC-midnight marker. */
  day: Date;
  today: Date;
  now: Date;
  /** The day's, the week's, or the whole book — whichever `view` asked for. */
  bookings: Booking[];
  hours: WorkingHour[];
  listSegment: number;
  listCapped: boolean;
}) {
  const router = useRouter();
  const [paywall, setPaywall] = useState(false);
  const weekUnlocked = hasFeature(business.plan, "weekView");

  const isToday = day.getTime() === today.getTime();
  const dayIso = toIsoDay(day);

  const href = (next: { d?: Date; view?: CalendarViewMode; seg?: number }) => {
    const params = new URLSearchParams();
    params.set("d", toIsoDay(next.d ?? day));
    params.set("view", next.view ?? view);
    const seg = next.seg ?? listSegment;
    if ((next.view ?? view) === "list" && seg > 0) params.set("seg", String(seg));
    return `/business?${params.toString()}`;
  };

  function selectView(index: number) {
    const modes: CalendarViewMode[] = ["day", "week", "list"];
    const target = modes[index]!;
    // The lock is a glyph, not `disabled` — pressing it is how an owner finds out what
    // Week is, so it explains itself instead of doing nothing.
    if (target === "week" && !weekUnlocked) {
      setPaywall(true);
      return;
    }
    router.push(href({ view: target }));
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      {/* ---------------------------------------------------------- the header -- */}
      <div className="gap-base mb-base flex flex-wrap items-center">
        <h1 className="text-display-lg text-ink min-w-0 flex-1 font-medium">
          {day.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "short",
            // A day marker is already a UTC midnight — formatting it in Thimphu would
            // shift it back six hours and name the day before.
            timeZone: "UTC",
          })}
        </h1>

        {isToday ? null : (
          <Link
            href={href({ d: today })}
            className="text-title text-rausch-cta px-sm min-h-12 items-center font-medium flex"
          >
            Today
          </Link>
        )}

        {/* A native date input rather than a bespoke picker: it is the one control every
            platform already draws well, it is keyboard-accessible for free, and the app's
            equivalent is the OS picker for the same reason. */}
        <label className="gap-xs flex items-center">
          <span className="sr-only">Pick a date</span>
          <input
            type="date"
            value={dayIso}
            onChange={(e) => {
              if (e.target.value) router.push(href({ d: new Date(`${e.target.value}T00:00:00Z`) }));
            }}
            className="border-hairline text-body-sm text-ink px-md min-h-12 rounded-sm border bg-transparent"
          />
        </label>
      </div>

      <div className="gap-base mb-base flex flex-wrap items-center">
        <SegmentedControl
          label="Calendar view"
          labels={["Day", "Week", "List"]}
          locked={[false, !weekUnlocked, false]}
          index={view === "day" ? 0 : view === "week" ? 1 : 2}
          onChange={selectView}
          className="min-w-[240px] flex-1"
        />
        {view === "list" ? null : (
          <Link
            href={`/business/walk-in?date=${dayIso}`}
            className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed gap-sm px-md flex min-h-12 items-center rounded-sm font-medium"
          >
            <Icons.walkIn
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            Walk-in
          </Link>
        )}
      </div>

      {/* ------------------------------------------------------------ the body -- */}
      {view === "day" ? (
        <DayBody
          bookings={bookings}
          hours={hours}
          day={day}
          today={today}
          now={now}
          hrefFor={(d) => href({ d })}
          showNow={isToday}
        />
      ) : view === "week" ? (
        <WeekBody bookings={bookings} day={day} hrefFor={(d) => href({ d, view: "week" })} />
      ) : (
        <ListBody
          bookings={bookings}
          segment={listSegment}
          capped={listCapped}
          onSegment={(seg) => router.push(href({ view: "list", seg }))}
        />
      )}

      <PaywallSheet open={paywall} onClose={() => setPaywall(false)} feature="weekView" />
    </div>
  );
}

/* ------------------------------------------------------------------- day ---- */

function DayBody({
  bookings,
  hours,
  day,
  today,
  now,
  hrefFor,
  showNow,
}: {
  bookings: Booking[];
  hours: WorkingHour[];
  day: Date;
  today: Date;
  now: Date;
  hrefFor: (d: Date) => string;
  showNow: boolean;
}) {
  const openMinutes = openMinutesForWeekday(hours, thimphuWeekday(day));

  return (
    <>
      <DateStrip day={day} today={today} hrefFor={hrefFor} />
      <TodayHeader bookings={bookings} now={now} openMinutes={openMinutes} />
      <Agenda bookings={bookings} now={now} showNow={showNow} />
    </>
  );
}

/** Fourteen days from today, as the app's `_DateStrip`. Scrolls inside itself. */
function DateStrip({
  day,
  today,
  hrefFor,
}: {
  day: Date;
  today: Date;
  hrefFor: (d: Date) => string;
}) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  return (
    <ul className="gap-sm mb-base flex overflow-x-auto pb-1">
      {days.map((d) => {
        const selected = d.getTime() === day.getTime();
        const isToday = d.getTime() === today.getTime();
        return (
          <li key={d.toISOString()} className="shrink-0">
            <Link
              href={hrefFor(d)}
              aria-current={selected ? "date" : undefined}
              className={cn(
                "py-sm flex w-13 flex-col items-center rounded-sm",
                selected ? "bg-ink text-on-primary" : "bg-surface-soft hover:bg-surface-strong",
              )}
            >
              <span
                className={cn(
                  "text-caption-sm font-semibold uppercase",
                  selected ? "text-on-primary/80" : "text-muted",
                )}
              >
                {d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
              </span>
              <span
                className={cn(
                  "text-title font-semibold tabular-nums",
                  selected ? "text-on-primary" : isToday ? "text-rausch" : "text-ink",
                )}
              >
                {d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" })}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The day's bookings in order, with a single **NOW** rule before the first one still to
 * come — the app's `AgendaDayView`. Only on today: a divider on a past or future day would
 * be claiming a position in a day that is not running.
 */
function Agenda({
  bookings,
  now,
  showNow,
}: {
  bookings: Booking[];
  now: Date;
  showNow: boolean;
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Icons.bookingConfirmed}
        title="Nothing booked"
        message="Appointments and walk-ins for this day show up here."
      />
    );
  }

  const firstAhead = showNow
    ? bookings.findIndex((b) => b.startTs.getTime() > now.getTime())
    : -1;

  return (
    <ul className="gap-sm flex flex-col">
      {bookings.map((b, i) => (
        <li key={b.id}>
          {i === firstAhead ? <NowRule /> : null}
          {/* The day's own list is where a salon is run, so this is the one place the card
              carries its actions — the same surface the app puts them on. */}
          <OwnerBookingCard booking={b} actions />
        </li>
      ))}
      {/* Everything today has already started, so the rule belongs at the end. */}
      {showNow && firstAhead === -1 ? (
        <li>
          <NowRule />
        </li>
      ) : null}
    </ul>
  );
}

function NowRule() {
  return (
    <p className="gap-sm mb-sm flex items-center" aria-label="Now">
      <span className="bg-rausch size-2 shrink-0 rounded-full" aria-hidden />
      <span className="text-badge text-rausch font-semibold">NOW</span>
      <span className="bg-rausch/40 h-px flex-1" aria-hidden />
    </p>
  );
}

/* ------------------------------------------------------------------ week ---- */

/**
 * Seven days from the week's Sunday, each with its own section — the app's `WeekView`.
 *
 * **Cancelled and no-show bookings are absent here and present on the day view**, which is
 * `groupWeekByDay`'s doing and is right: a week is being read for shape and load, so a
 * count that included work nobody is doing would misreport how busy Thursday is. The day
 * view is a record and shows everything.
 */
function WeekBody({
  bookings,
  day,
  hrefFor,
}: {
  bookings: Booking[];
  day: Date;
  hrefFor: (d: Date) => string;
}) {
  const weekStart = addDays(day, -thimphuWeekday(day));
  const groups = groupWeekByDay(bookings, weekStart);
  const counts = perDayCounts(bookings, weekStart);

  return (
    <>
      <ul className="gap-xs mb-base flex">
        {groups.map((g, i) => {
          const selected = g.day.getTime() === day.getTime();
          const count = counts[i] ?? 0;
          return (
            <li key={g.day.toISOString()} className="min-w-0 flex-1">
              <Link
                href={hrefFor(g.day)}
                aria-current={selected ? "date" : undefined}
                className={cn(
                  "py-sm flex flex-col items-center rounded-sm",
                  selected
                    ? "bg-ink text-on-primary"
                    : count > 0
                      ? "bg-rausch/10 hover:bg-rausch/20"
                      : "bg-surface-soft hover:bg-surface-strong",
                )}
              >
                <span
                  className={cn(
                    "text-caption-sm font-semibold uppercase",
                    selected ? "text-on-primary/80" : "text-muted",
                  )}
                >
                  {g.day.toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" })}
                </span>
                <span
                  className={cn(
                    "text-title font-semibold tabular-nums",
                    selected ? "text-on-primary" : "text-ink",
                  )}
                >
                  {g.day.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" })}
                </span>
                <span
                  className={cn(
                    "text-badge font-semibold tabular-nums",
                    selected
                      ? "text-on-primary/80"
                      : count > 0
                        ? "text-rausch-cta"
                        : "text-muted-soft",
                  )}
                >
                  {count > 0 ? count : "–"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="gap-lg flex flex-col">
        {groups.map((g) => (
          <section key={g.day.toISOString()}>
            <h2 className="text-title text-ink mb-sm font-semibold">
              {g.day.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })}
            </h2>
            {g.bookings.length === 0 ? (
              <p className="text-body-sm text-muted">No bookings</p>
            ) : (
              <ul className="gap-sm flex flex-col">
                {g.bookings.map((b) => (
                  <li key={b.id}>
                    <OwnerBookingCard booking={b} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ list ---- */

const LIST_LABELS = ["Upcoming", "Completed", "Cancelled"];

/**
 * The whole book, split by lifecycle — the app's `BusinessBookingsTab`.
 *
 * Bucketed by **status, not date**, through `bookingTab` in `lib/types/booking.ts`, which
 * the customer's own list already uses and which is already tested: `pending`/`confirmed`
 * → Upcoming, `completed` → Completed, `cancelled`/`no_show` → Cancelled. A booking whose
 * time has passed but which nobody marked completed stays in Upcoming, and that is the
 * point — it is the owner's to-do list, not a clock.
 */
function ListBody({
  bookings,
  segment,
  capped,
  onSegment,
}: {
  bookings: Booking[];
  segment: number;
  capped: boolean;
  onSegment: (seg: number) => void;
}) {
  const counts = [0, 0, 0];
  for (const b of bookings) counts[bookingTab(b)]!++;
  const shown = bookings.filter((b) => bookingTab(b) === segment);

  return (
    <>
      <SegmentedControl
        label="Bookings by status"
        labels={LIST_LABELS}
        counts={counts}
        index={segment}
        onChange={onSegment}
        className="mb-base"
      />

      {capped ? (
        <p className="text-caption-sm text-muted mb-base">
          Showing the 200 most recent bookings.
        </p>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState
          icon={Icons.booking}
          title={`No ${LIST_LABELS[segment]!.toLowerCase()} bookings`}
          message={
            segment === 0
              ? "New bookings — and walk-ins you add — show up here."
              : undefined
          }
        />
      ) : (
        <ul className="gap-sm flex flex-col">
          {shown.map((b) => (
            <li key={b.id}>
              {/* Actions here too, and only here besides the agenda: the Upcoming segment is
                  the owner's catch-up list — bookings whose time has passed that nobody
                  marked — and clearing it one detail page at a time is exactly the toll the
                  agenda's actions remove. `InlineBookingActions` renders nothing on a
                  terminal booking, so the other two segments are unaffected. */}
              <OwnerBookingCard booking={b} actions />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
