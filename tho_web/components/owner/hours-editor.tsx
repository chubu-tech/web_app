"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CopyToDaysSheet } from "@/components/owner/copy-to-days-sheet";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import {
  DAY_NAMES,
  copyDay,
  dayHasOverlap,
  enabledSegments,
  gapsFor,
  mergeGap,
  segment,
  splitForLunch,
  withDay,
  withSegments,
  type Segment,
  type WeekHours,
} from "@/lib/hours";
import { formatMinutesOfDay, minutesOfDay } from "@/lib/time";

/** What a day the owner has not configured yet shows in its placeholder row. */
const DEFAULT_START = 9 * 60;
const DEFAULT_END = 18 * 60;

/** `<input type="time">` cannot express 24:00, so a stretch can end at 23:59 at the latest. */
const LATEST = 23 * 60 + 59;

/**
 * The weekly hours grid — a port of `working_hours_editor.dart`, shared by the stylist
 * editor and the salon's own opening hours.
 *
 * **Stateless on purpose.** The parent owns the `WeekHours` and rebuilds on `onChange`, so
 * nothing reaches the database until the parent's Save. That is what makes the same grid
 * usable for two tables with two different write paths — an atomic RPC for a stylist, an
 * upsert-then-delete for the salon.
 *
 * **`openWeekdays` is guidance, not a rule**, and only the stylist editor passes it. A day
 * outside it renders as *"Unavailable — 2 saved hours kept"* with a Clear and no controls:
 * those rows are still real, bookable `staff_working_hours` (nothing in the booking engine
 * consults `business_hours`), so hiding them would leave an invisible, undeletable stretch.
 * A plain count and one destructive affordance is the honest answer.
 *
 * **A lunch break is a gap, not a row.** Splitting a stretch in two makes the middle
 * unbookable for free, because `is_bookable_window` requires a booking to sit inside a single
 * interval. Removing the pill merges the two back into one.
 *
 * Times are native `<input type="time">` — 24-hour, keyboard-accessible, and drawn by the
 * platform, the same call `/business`'s date picker makes. That is also why nothing here uses
 * the Dart's 12-hour `formatMinutes12`.
 */
export function HoursEditor({
  week,
  openWeekdays,
  onChange,
}: {
  week: WeekHours;
  /** Stylist editor only. Omit for the salon's own hours, which *define* this set. */
  openWeekdays?: Set<number>;
  onChange: (next: WeekHours) => void;
}) {
  const [copyFrom, setCopyFrom] = useState<number | null>(null);

  /** What the grid draws for a day: its segments, or one greyed placeholder. */
  function rowsFor(dayIndex: number): Segment[] {
    const day = week[dayIndex]!;
    if (day.segments.length === 0) {
      return [segment(DEFAULT_START, DEFAULT_END, false)];
    }
    return [...enabledSegments(day), ...day.segments.filter((s) => !s.enabled)];
  }

  function replaceRows(dayIndex: number, rows: Segment[]) {
    onChange(withDay(week, withSegments(week[dayIndex]!, rows)));
  }

  function toggleRow(dayIndex: number, rowIndex: number, enabled: boolean) {
    const rows = [...rowsFor(dayIndex)];
    rows[rowIndex] = { ...rows[rowIndex]!, enabled };
    // An all-disabled day is stored as an empty day, so it reads as Unavailable and
    // contributes nothing to the payload.
    replaceRows(dayIndex, rows.some((s) => s.enabled) ? rows : []);
  }

  function setTime(dayIndex: number, rowIndex: number, isStart: boolean, value: string) {
    if (!value) return;
    const minutes = Math.min(minutesOfDay(value), LATEST);
    const rows = [...rowsFor(dayIndex)];
    const row = rows[rowIndex]!;
    // Editing a time enables the row: the placeholder is how an unconfigured day offers
    // itself, and typing into it is the whole gesture.
    rows[rowIndex] = isStart
      ? { ...row, startMin: minutes, enabled: true }
      : { ...row, endMin: minutes, enabled: true };
    replaceRows(dayIndex, rows);
  }

  function addStretch(dayIndex: number) {
    const rows = rowsFor(dayIndex).filter((s) => s.enabled);
    const start = rows.length === 0 ? DEFAULT_START : rows[rows.length - 1]!.endMin;
    const end = Math.min(start + 60, LATEST);
    if (end <= start) return; // already at the end of the day
    replaceRows(dayIndex, [...rows, segment(start, end)]);
  }

  function addLunch(dayIndex: number) {
    const day = week[dayIndex]!;
    const only = enabledSegments(day)[0];
    if (!only) return;
    // Noon to one, or the middle hour of a short day. Picked here rather than asked for,
    // because the pill is immediately editable — the app asks with two time pickers in a row,
    // which is three interactions to get to something you then have to check anyway.
    const start = Math.max(only.startMin + 30, Math.min(12 * 60, only.endMin - 90));
    const end = Math.min(start + 60, only.endMin - 30);
    try {
      onChange(withDay(week, splitForLunch(day, 0, start, end)));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "That day is too short to split.");
    }
  }

  return (
    <>
      {/* Named, because a bare list of seven days announces as "list, 7 items" beside the
          services list on the same screen — and it is what the verification harness scopes to,
          after a run in which `main li` matched the service checkboxes and every day-indexed
          assertion silently addressed the wrong rows. */}
      <ul className="gap-lg flex flex-col" aria-label="Weekly hours">
        {week.map((day, dayIndex) => {
          const closed = openWeekdays != null && !openWeekdays.has(dayIndex);
          const saved = enabledSegments(day).length;

          if (closed) {
            return (
              <li key={dayIndex} className="gap-sm flex flex-wrap items-center">
                <span className="text-title text-muted font-medium">{DAY_NAMES[dayIndex]}</span>
                <span className="text-body-sm text-muted">
                  Unavailable
                  {saved > 0 ? ` — ${saved} saved ${saved === 1 ? "stretch" : "stretches"} kept` : ""}
                </span>
                {saved > 0 ? (
                  <Button
                    variant="quiet"
                    className="px-sm"
                    onClick={() => replaceRows(dayIndex, [])}
                  >
                    Clear
                  </Button>
                ) : null}
              </li>
            );
          }

          const rows = rowsFor(dayIndex);
          const gaps = gapsFor(day);

          return (
            <li key={dayIndex}>
              <div className="mb-sm flex items-center justify-between">
                <span className="text-title text-muted font-medium">{DAY_NAMES[dayIndex]}</span>
                <span className="gap-xs flex">
                  <Button
                    variant="quiet"
                    className="px-sm"
                    onClick={() => addStretch(dayIndex)}
                    aria-label={`Add another stretch on ${DAY_NAMES[dayIndex]}`}
                  >
                    <Icons.add style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
                  </Button>
                  <Button
                    variant="quiet"
                    className="px-sm"
                    onClick={() => setCopyFrom(dayIndex)}
                    aria-label={`Copy ${DAY_NAMES[dayIndex]} to other days`}
                  >
                    <Icons.copy style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
                  </Button>
                </span>
              </div>

              <div className="gap-sm flex flex-col">
                {rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="gap-sm flex items-center">
                    <label className="shrink-0 cursor-pointer">
                      <span className="sr-only">
                        {row.enabled ? "Working" : "Not working"} on {DAY_NAMES[dayIndex]}
                      </span>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => toggleRow(dayIndex, rowIndex, e.target.checked)}
                        className="accent-rausch-cta size-5"
                      />
                    </label>
                    <TimeInput
                      label={`${DAY_NAMES[dayIndex]} start`}
                      minutes={row.startMin}
                      muted={!row.enabled}
                      onChange={(v) => setTime(dayIndex, rowIndex, true, v)}
                    />
                    <span className="text-body-sm text-muted" aria-hidden>
                      –
                    </span>
                    <TimeInput
                      label={`${DAY_NAMES[dayIndex]} end`}
                      minutes={row.endMin}
                      muted={!row.enabled}
                      onChange={(v) => setTime(dayIndex, rowIndex, false, v)}
                    />
                  </div>
                ))}
              </div>

              {dayHasOverlap(day) ? (
                <p className="text-caption text-rausch-cta mt-xs">These hours overlap.</p>
              ) : null}

              {gaps.map((gap, i) => (
                <div key={gap.index} className="gap-xs mt-sm ml-xxl flex items-center">
                  <span className="bg-surface-strong text-caption text-muted gap-xs px-sm py-xs inline-flex items-center rounded-full">
                    <Icons.lunch
                      style={{ width: IconSize.xs, height: IconSize.xs }}
                      aria-hidden
                    />
                    {i === 0 ? "Lunch" : "Break"} {formatMinutesOfDay(gap.startMin)} –{" "}
                    {formatMinutesOfDay(gap.endMin)}
                  </span>
                  <Button
                    variant="quiet"
                    className="px-sm"
                    onClick={() => onChange(withDay(week, mergeGap(day, gap.index)))}
                    aria-label={`Remove the break on ${DAY_NAMES[dayIndex]}`}
                  >
                    <Icons.close style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
                  </Button>
                </div>
              ))}

              {enabledSegments(day).length === 1 ? (
                <Button variant="quiet" className="mt-xs px-0" onClick={() => addLunch(dayIndex)}>
                  <Icons.lunch style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
                  Add a break
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {copyFrom != null ? (
        <CopyToDaysSheet
          key={copyFrom}
          sourceDay={copyFrom}
          openWeekdays={openWeekdays}
          onClose={() => setCopyFrom(null)}
          onCopy={(targets) => {
            onChange(copyDay(week, copyFrom, targets));
            setCopyFrom(null);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * One end of a stretch.
 *
 * A native time input: it is 24-hour in its value whatever the viewer's locale shows, which
 * is what `minutesOfDay` parses, and it is keyboard- and screen-reader-correct without any of
 * that being reimplemented. `max` stops a stretch running past 23:59, so the 1440 end-of-day
 * case the Dart has to format specially cannot arise here.
 */
function TimeInput({
  label,
  minutes,
  muted,
  onChange,
}: {
  label: string;
  minutes: number;
  muted: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        type="time"
        value={formatMinutesOfDay(Math.min(minutes, LATEST))}
        max="23:59"
        onChange={(e) => onChange(e.target.value)}
        className={
          "border-hairline text-body-md focus:border-ink px-sm min-h-11 w-full rounded-sm border bg-transparent text-center outline-none focus:border-2 " +
          (muted ? "text-muted-soft" : "text-ink")
        }
      />
    </label>
  );
}
