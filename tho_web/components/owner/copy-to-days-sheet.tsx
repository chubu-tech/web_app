"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { DAY_NAMES } from "@/lib/hours";

/**
 * Copy one day's hours onto others — a port of `copy_to_days_sheet.dart`, including its
 * three widget tests' rules:
 *
 * - **A day the shop is closed is never offered as a target.** Only the stylist editor passes
 *   `openWeekdays`; the salon's own hours page has no outer constraint, so every other day is
 *   offerable there.
 * - **The source day itself is never offered**, because copying a day onto itself is the
 *   no-op `copyDay` already guards against, and offering it would imply otherwise.
 * - **The sheet scrolls rather than overflowing** when all seven weekdays are open — the
 *   densest case, and the one the Dart's third test exists for. `Sheet` caps its own height
 *   and scrolls, so that comes for free here.
 *
 * Copying **replaces** the target days, which the copy says out loud: it is the one action in
 * the editor that can destroy hours the owner did not have open in front of them.
 *
 * Mounted only while open and keyed by the source day (see `HoursEditor`), so the selection
 * starts empty on every open without an effect resetting it — the previous copy's targets are
 * not a sensible default for the next one.
 */
export function CopyToDaysSheet({
  sourceDay,
  openWeekdays,
  onClose,
  onCopy,
}: {
  sourceDay: number;
  openWeekdays?: Set<number>;
  onClose: () => void;
  onCopy: (targets: number[]) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);

  const targets = [0, 1, 2, 3, 4, 5, 6].filter(
    (d) => d !== sourceDay && (openWeekdays == null || openWeekdays.has(d)),
  );

  function toggle(day: number, on: boolean) {
    setSelected((current) => (on ? [...current, day] : current.filter((d) => d !== day)));
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Copy ${DAY_NAMES[sourceDay]} to`}
      footer={
        <Button fullWidth disabled={selected.length === 0} onClick={() => onCopy(selected)}>
          Copy
        </Button>
      }
    >
      <p className="text-body-sm text-muted mb-base">
        This replaces the hours on the days you pick.
      </p>

      <div className="gap-sm mb-base flex flex-wrap">
        <Button
          variant="quiet"
          className="px-sm"
          onClick={() => setSelected(targets.filter((d) => d >= 1 && d <= 5))}
        >
          Weekdays
        </Button>
        <Button variant="quiet" className="px-sm" onClick={() => setSelected(targets)}>
          All days
        </Button>
      </div>

      <ul className="divide-hairline-soft divide-y">
        {targets.map((d) => (
          <li key={d}>
            <label className="gap-base py-md flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={selected.includes(d)}
                onChange={(e) => toggle(d, e.target.checked)}
                className="accent-rausch-cta size-5"
              />
              <span className="text-body-md text-ink">{DAY_NAMES[d]}</span>
            </label>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
