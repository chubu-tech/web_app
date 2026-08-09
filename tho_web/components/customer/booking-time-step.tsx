"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatMinutesOfDay, thimphuMinutesOfDay, toIsoDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { SlotOption } from "./use-availability";

/** The app's own window — `booking_screen.dart:358` offers the next 60 days. */
export const DAYS_AHEAD = 60;

/** Days on screen at once. Seven, so the strip is a week and paging is a week. */
const PAGE = 7;

/**
 * Step 3 — **Select date and time**.
 *
 * ## A paged week, not a 60-day scroller
 *
 * The flow this replaced rendered all 60 days in one horizontally-scrolling strip, which
 * on a desktop browser is a 60-item row with no way to move a week at a time. This shows
 * seven with `‹ ›` paging, which is Fresha's shape and, more usefully, makes "next week"
 * one press instead of a drag of unknown length. The window is still 60 days, and the
 * arrows stop at both ends rather than wrapping.
 *
 * ## Times are rows, not chips
 *
 * Full-width rows, because at desktop width a grid of 15-minute chips is a wall of
 * near-identical pills and the thing being compared is a single number. Rows also leave
 * room for the second line "any professional" needs, where a slot is offered by more than
 * one stylist.
 *
 * ## Days are Thimphu days, held as UTC midnight
 *
 * So every label formats with `timeZone: "UTC"` — reading these `Date`s in the browser's
 * zone shifts the weekday by one for anybody west of Bhutan. The *times* are the opposite
 * case and go through `thimphuMinutesOfDay`, which is what makes a customer in London see
 * the hour they will actually turn up at.
 */
export function BookingTimeStep({
  today,
  day,
  onPickDay,
  slots,
  loading,
  error,
  selectedStart,
  onPickSlot,
  onRetry,
  staffLabel,
  onChangeStaff,
}: {
  /** Thimphu's today, resolved on the server so two renders cannot disagree. */
  today: Date;
  day: Date;
  onPickDay: (day: Date) => void;
  slots: SlotOption[];
  loading: boolean;
  error: boolean;
  selectedStart: Date | null;
  onPickSlot: (slot: SlotOption) => void;
  onRetry: () => void;
  /** The stylist chip's text — a name, or "Any professional". */
  staffLabel: string;
  /** Jumps back to step 2. Fresha puts the same control here. */
  onChangeStaff: () => void;
}) {
  // Which week of the window the strip is showing, derived from the selected day so a
  // day restored from the URL opens on its own page rather than on the first one.
  const offset = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  const pageStart = Math.max(0, Math.min(Math.floor(offset / PAGE) * PAGE, DAYS_AHEAD - PAGE));
  const days = Array.from({ length: PAGE }, (_, i) => addDays(today, pageStart + i));

  const canBack = pageStart > 0;
  const canForward = pageStart + PAGE < DAYS_AHEAD;

  return (
    <div>
      {/* The stylist, restated and changeable without going back a step — the one thing
          somebody re-decides once they see how little the chosen person has free. */}
      <button
        type="button"
        onClick={onChangeStaff}
        className="border-hairline bg-paper text-title text-ink hover:border-border-strong gap-sm mb-lg px-base inline-flex min-h-11 items-center rounded-full border font-medium"
      >
        {staffLabel}
        <Icons.chevronDown
          className="text-muted"
          style={{ width: IconSize.xs, height: IconSize.xs }}
          aria-hidden
        />
      </button>

      <div className="mb-md flex items-center">
        <h2 className="text-display-sm text-ink flex-1 font-semibold">Select a date</h2>
        <div className="gap-xs flex items-center">
          <PageButton
            direction="back"
            disabled={!canBack}
            onClick={() => onPickDay(addDays(today, Math.max(0, pageStart - PAGE)))}
          />
          <PageButton
            direction="forward"
            disabled={!canForward}
            onClick={() =>
              onPickDay(addDays(today, Math.min(DAYS_AHEAD - 1, pageStart + PAGE)))
            }
          />
        </div>
      </div>

      <ul className="gap-sm mb-xl grid grid-cols-7" aria-label="Choose a date">
        {days.map((d) => {
          const selected = d.getTime() === day.getTime();
          return (
            <li key={toIsoDay(d)}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onPickDay(d)}
                className={cn(
                  "py-md flex w-full flex-col items-center justify-center rounded-md border",
                  "transition-colors duration-[var(--duration-base)]",
                  selected
                    ? "border-rausch-cta bg-rausch-cta"
                    : "border-hairline bg-paper hover:border-border-strong",
                )}
              >
                <Label selected={selected} dim>
                  {d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                </Label>
                <span
                  className={cn(
                    "text-display-sm font-semibold",
                    selected ? "text-on-primary" : "text-ink",
                  )}
                >
                  {d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" })}
                </span>
                <Label selected={selected} dim>
                  {d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
                </Label>
              </button>
            </li>
          );
        })}
      </ul>

      <h2 className="text-display-sm text-ink mb-md font-semibold">Pick a time</h2>

      {loading ? (
        <ul className="gap-sm flex flex-col">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-14 rounded-lg" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <EmptyState
          icon={Icons.offline}
          title="Couldn't load times"
          message="Check your connection and try again."
          action={<Button onClick={onRetry}>Try again</Button>}
        />
      ) : slots.length === 0 ? (
        <EmptyState
          icon={Icons.clock}
          title="Nothing free that day"
          message="Try another date, or pick a different professional."
        />
      ) : (
        <ul className="gap-sm flex flex-col">
          {slots.map((slot) => {
            const selected = selectedStart?.getTime() === slot.start.getTime();
            return (
              <li key={slot.start.toISOString()}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPickSlot(slot)}
                  className={cn(
                    "px-lg py-md flex w-full items-center rounded-lg border text-left",
                    "transition-colors duration-[var(--duration-fast)]",
                    selected
                      ? "border-rausch-cta bg-paper"
                      : "border-hairline-soft bg-paper hover:border-border-strong",
                  )}
                >
                  <span className="text-title text-ink flex-1 font-medium tabular-nums">
                    {formatMinutesOfDay(thimphuMinutesOfDay(slot.start))}
                  </span>
                  {/* Only where it says something: with a named stylist every row would
                      read "1 available", which is not information. */}
                  {slot.staffIds.length > 1 ? (
                    <span className="text-caption text-muted shrink-0">
                      {slot.staffIds.length} available
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Label({
  selected,
  dim,
  children,
}: {
  selected: boolean;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-caption-sm font-medium",
        selected ? "text-on-primary/85" : dim ? "text-muted" : "text-ink",
      )}
    >
      {children}
    </span>
  );
}

function PageButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "back" | "forward";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "back" ? Icons.chevronLeft : Icons.chevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "back" ? "Earlier dates" : "Later dates"}
      className="border-hairline text-ink hover:border-border-strong disabled:text-muted-soft grid size-11 place-items-center rounded-full border disabled:cursor-not-allowed"
    >
      <Icon style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
    </button>
  );
}
