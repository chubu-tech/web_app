"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { RadioDot } from "@/components/ui/select-tile";
import { StarBar } from "@/components/ui/rating";
import {
  DISTANCE_DEFAULT,
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  EMPTY_FILTERS,
  PRICE_DEFAULT,
  PRICE_MAX,
  PRICE_MIN,
  RATING_TIERS,
  type GenderFilter,
  type Range,
  type SalonFilters,
} from "@/lib/salon-filters";
import type { Category } from "@/lib/types/salon";
import { formatNu } from "@/lib/utils";

/**
 * The discovery filter form, ported from
 * `tho/app/lib/customer/filter_screen.dart`: Gender · Category · Reviews ·
 * Distance · Price, with Reset and Apply.
 *
 * It edits a **draft** and only commits on Apply, as the app does. That is not just
 * fidelity: every apply rewrites the URL, which re-runs the server query, so a
 * live-updating slider would fire a request per pixel of drag.
 */
export function FilterPanel({
  categories,
  initial,
  onApply,
  onClose,
}: {
  categories: Category[];
  initial: SalonFilters;
  onApply: (next: SalonFilters) => void;
  /** Present when the panel is inside a sheet; absent in the desktop rail. */
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState<SalonFilters>(initial);

  const set = <K extends keyof SalonFilters>(key: K, value: SalonFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="flex h-full flex-col">
      <div className="px-base py-base gap-xl flex flex-1 flex-col overflow-y-auto">
        <Group title="Gender preference">
          <div className="gap-sm flex flex-wrap">
            {(
              [
                ["any", "Any"],
                ["women", "Women"],
                ["men", "Men"],
              ] as [GenderFilter, string][]
            ).map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                selected={draft.gender === value}
                onClick={() => set("gender", value)}
              />
            ))}
          </div>
        </Group>

        <Group title="Service category">
          {categories.length === 0 ? (
            <p className="text-body-sm text-muted">No categories yet</p>
          ) : (
            <div className="gap-sm flex flex-wrap">
              {categories.map((c) => {
                const selected = draft.categoryId === c.id;
                return (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={selected}
                    // Tap-to-toggle: choosing the same one again clears back to all.
                    onClick={() => set("categoryId", selected ? null : c.id)}
                  />
                );
              })}
            </div>
          )}
        </Group>

        <Group title="Reviews">
          <ul>
            {RATING_TIERS.map((tier) => {
              const selected = draft.minRating === tier.min;
              return (
                <li key={tier.min}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => set("minRating", selected ? null : tier.min)}
                    className="gap-md py-sm flex w-full items-center text-left"
                  >
                    {/* Each tier depicts its own threshold. Every row used to show
                        five full stars, so "3.0 – 3.5" was illustrated with a
                        perfect score (THO-14). */}
                    <StarBar rating={tier.min} size={18} />
                    <span className="text-body-md text-ink flex-1">{tier.label}</span>
                    <RadioDot selected={selected} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Group>

        <Group title="Distance">
          <RangePair
            value={draft.distance}
            min={DISTANCE_MIN_KM}
            max={DISTANCE_MAX_KM}
            step={1}
            format={(v) => `${v} km`}
            lowLabel="Minimum distance"
            highLabel="Maximum distance"
            onChange={(next) => set("distance", next)}
          />
        </Group>

        <Group title="Price range">
          <RangePair
            value={draft.price}
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={100}
            format={formatNu}
            lowLabel="Lowest price"
            highLabel="Highest price"
            onChange={(next) => set("price", next)}
          />
        </Group>
      </div>

      <div className="border-hairline p-base gap-md flex shrink-0 border-t">
        <Button
          variant="pillQuiet"
          className="flex-5"
          onClick={() => setDraft(EMPTY_FILTERS)}
        >
          Reset
        </Button>
        <Button
          variant="pill"
          className="flex-7"
          onClick={() => {
            onApply(draft);
            onClose?.();
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-display-sm text-ink mb-md font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * A two-thumb range, as **two labelled native sliders** rather than one custom
 * control.
 *
 * The app uses Flutter's `RangeSlider`; the web has no two-thumb equivalent, and a
 * hand-rolled drag widget is where keyboard access and screen-reader support
 * usually get lost. Two `<input type="range">` elements each announce their own
 * value and respond to arrow keys for free, and clamping keeps them from crossing.
 */
function RangePair({
  value,
  min,
  max,
  step,
  format,
  lowLabel,
  highLabel,
  onChange,
}: {
  value: Range;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  lowLabel: string;
  highLabel: string;
  onChange: (next: Range) => void;
}) {
  const atDefault =
    (value.start === DISTANCE_DEFAULT.start && value.end === DISTANCE_DEFAULT.end) ||
    (value.start === PRICE_DEFAULT.start && value.end === PRICE_DEFAULT.end);

  return (
    <div className="gap-md flex flex-col">
      <p className="text-body-sm text-ink tabular-nums">
        {format(value.start)} – {format(value.end)}
        {atDefault ? <span className="text-muted"> · everything</span> : null}
      </p>
      <label className="gap-sm flex items-center">
        <span className="text-caption-sm text-muted w-16 shrink-0">{lowLabel}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value.start}
          aria-valuetext={format(value.start)}
          onChange={(e) => {
            const start = Number(e.target.value);
            onChange({ start, end: Math.max(start, value.end) });
          }}
          className="accent-rausch-cta h-6 flex-1"
        />
      </label>
      <label className="gap-sm flex items-center">
        <span className="text-caption-sm text-muted w-16 shrink-0">{highLabel}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value.end}
          aria-valuetext={format(value.end)}
          onChange={(e) => {
            const end = Number(e.target.value);
            onChange({ start: Math.min(value.start, end), end });
          }}
          className="accent-rausch-cta h-6 flex-1"
        />
      </label>
    </div>
  );
}
