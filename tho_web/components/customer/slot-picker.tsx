"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupByDayPart } from "@/lib/booking-basket";
import { SlotChip } from "@/components/ui/slot-chip";
import { fetchAvailability } from "@/lib/api/booking";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  formatMinutesOfDay,
  thimphuDayBoundsUtc,
  thimphuMinutesOfDay,
  thimphuToday,
  toIsoDay,
} from "@/lib/time";
import type { Slot } from "@/lib/types/booking";
import { cn } from "@/lib/utils";

/**
 * The date strip and slot grid, shared by booking and rescheduling — which is why it
 * is a component rather than living inside the booking screen. The app has two
 * near-identical copies of it (`booking_screen.dart` and `reschedule_screen.dart`),
 * and they have already drifted: one shows a skeleton while loading, the other a bare
 * spinner.
 *
 * **Days are Thimphu days.** `compute_availability` is asked for the UTC bounds of a
 * Thimphu calendar day (`thimphuDayBoundsUtc`), and slot times are rendered in Thimphu
 * — not the browser's zone. A customer in London looking at a Bhutanese salon must see
 * the time they will actually turn up at.
 */

/** The app's window: the next 60 days (`booking_screen.dart:358`). */
const DAYS_AHEAD = 60;

export function SlotPicker({
  staffId,
  serviceIds,
  selected,
  onSelect,
  disabled = false,
  reloadKey = 0,
  initialDay,
}: {
  staffId: string;
  serviceIds: string[];
  selected: Slot | null;
  onSelect: (slot: Slot | null) => void;
  disabled?: boolean;
  /** Bump to re-fetch — after a failed write, so a taken slot disappears. */
  reloadKey?: number;
  /**
   * Which day to open on. Added in 3a so the owner's walk-in form can inherit the day the
   * calendar was showing; a customer always starts on today, which stays the default.
   * Clamped into the strip's own window, so a stale `?date=` from last month cannot select
   * a day the strip does not contain.
   */
  initialDay?: Date;
}) {
  const today = thimphuToday();
  const [day, setDay] = useState<Date>(() => clampToWindow(initialDay, today));
  const [retryTick, setRetryTick] = useState(0);

  /**
   * Which request the state below belongs to.
   *
   * Results are stored **with** their request key and the loading state is derived
   * from a mismatch, rather than reset in an effect before each fetch. That is not
   * only tidier: a reset-then-fetch pair renders twice, and a late response from the
   * previous day can no longer be mistaken for the current one.
   */
  const requestKey = [
    staffId,
    serviceIds.join(","),
    day.getTime(),
    retryTick,
    reloadKey,
  ].join("|");

  const [result, setResult] = useState<{
    key: string;
    slots: Slot[];
    failed: boolean;
  } | null>(null);

  const current = result?.key === requestKey ? result : null;

  useEffect(() => {
    let live = true;
    const { from, to } = thimphuDayBoundsUtc(day);
    fetchAvailability(createClient(), { staffId, serviceIds, from, to })
      .then((slots) => {
        if (live) setResult({ key: requestKey, slots, failed: false });
      })
      .catch(() => {
        if (live) setResult({ key: requestKey, slots: [], failed: true });
      });
    return () => {
      live = false;
    };
    // `day`, `staffId` and `serviceIds` are all folded into `requestKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  /** Changing the day clears the choice — a Tuesday slot must not stay selected
   *  while Wednesday's grid is on screen. Done here, in the handler, because that
   *  is what it is: a consequence of the click. */
  function pickDay(next: Date) {
    setDay(next);
    onSelect(null);
  }

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  return (
    <div>
      <ul className="gap-sm flex overflow-x-auto pb-2" aria-label="Choose a date">
        {days.map((d) => {
          const isSelected = d.getTime() === day.getTime();
          return (
            <li key={toIsoDay(d)}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => pickDay(d)}
                className={cn(
                  "flex w-14 shrink-0 flex-col items-center justify-center rounded-md border py-md",
                  "transition-colors duration-[var(--duration-base)]",
                  isSelected
                    ? "border-ink bg-ink"
                    : "border-hairline bg-canvas hover:border-border-strong",
                )}
              >
                <span
                  className={cn(
                    "text-caption-sm font-semibold uppercase",
                    isSelected ? "text-on-primary" : "text-muted",
                  )}
                >
                  {/* timeZone UTC because a Thimphu day is held as a UTC-midnight
                      Date — reading it in the browser's zone would shift the label. */}
                  {d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                </span>
                <span
                  className={cn(
                    "text-title font-semibold",
                    isSelected ? "text-on-primary" : "text-ink",
                  )}
                >
                  {d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-hairline-soft mt-base border-t pt-base">
        {current == null ? (
          <ul className="gap-md grid grid-cols-3 tablet:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-12 rounded-full" />
              </li>
            ))}
          </ul>
        ) : current.failed ? (
          <EmptyState
            icon={Icons.offline}
            title="Couldn't load times"
            message="Check your connection and try again."
            action={
              <Button
                variant="outlined"
                onClick={() => {
                  onSelect(null);
                  setRetryTick((t) => t + 1);
                }}
              >
                Retry
              </Button>
            }
          />
        ) : current.slots.length === 0 ? (
          <EmptyState
            icon={Icons.clock}
            title="No open times"
            message="Nothing free that day — try another date."
          />
        ) : (
          /*
            Grouped into Morning / Afternoon / Evening, the same three blocks the booking flow's
            time step uses and the app uses in both places. One `fieldset` around all of them,
            not one per block: the radio group is a single choice of time, and splitting it into
            three would announce three separate questions.
          */
          <fieldset>
            <legend className="sr-only">Choose a time</legend>
            <div className="gap-base flex flex-col">
              {groupByDayPart(current.slots, (s) => s.start).map((group) => (
                <div key={group.part}>
                  <h4 className="text-caption text-muted mb-sm font-medium">{group.label}</h4>
                  <ul className="gap-md grid grid-cols-3 tablet:grid-cols-4">
                    {group.slots.map((slot) => {
                      const key = slot.start.toISOString();
                      return (
                        <li key={key}>
                          <SlotChip
                            name="slot"
                            value={key}
                            label={formatMinutesOfDay(thimphuMinutesOfDay(slot.start))}
                            selected={selected?.start.getTime() === slot.start.getTime()}
                            disabled={disabled}
                            onSelect={() => onSelect(slot)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </div>
  );
}

/**
 * `initialDay` snapped into the strip's window — today through `DAYS_AHEAD`.
 *
 * A bookmarked or hand-edited `?date=` can name any day at all, and a day outside the strip
 * would leave the form on a date with no cell highlighted and no obvious way back.
 */
function clampToWindow(requested: Date | undefined, today: Date): Date {
  if (!requested) return today;
  const last = addDays(today, DAYS_AHEAD - 1);
  if (requested.getTime() < today.getTime()) return today;
  if (requested.getTime() > last.getTime()) return last;
  return requested;
}
