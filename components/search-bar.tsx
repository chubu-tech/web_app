"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  MapPin,
  Search,
} from "lucide-react";
import { search as copy } from "@/lib/content";
import type { SalonIndex } from "@/lib/salons";
import { TIME_WINDOWS, type Coords, type Query, type TimeWindow } from "@/lib/search";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  PanelChip,
  PanelHeading,
  PanelOption,
  SearchPanel,
} from "./search-panel";

type Facet = "treatment" | "place" | "when" | null;

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function prettyDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * The search bar: what you want done, where, and roughly when.
 *
 * All three facets narrow a list that is already on the page — the salons were
 * prerendered at build time — so there is no request, no spinner and no empty
 * first paint. The Search button exists to confirm and to scroll, not to fetch.
 */
export function SearchBar({
  index,
  query,
  onQuery,
  onLocate,
  origin,
  locating,
  locationError,
}: {
  index: SalonIndex;
  query: Query;
  onQuery: (next: Query) => void;
  onLocate: () => void;
  origin: Coords | null;
  locating: boolean;
  locationError: string | null;
}) {
  const [open, setOpen] = useState<Facet>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const close = () => setOpen(null);

  const today = new Date();
  const todayIso = iso(today);
  const tomorrowIso = iso(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  );

  const treatmentCount = useMemo(
    () =>
      new Set(index.groups.flatMap((g) => g.treatments.map((t) => t.name))).size,
    [index.groups],
  );

  const whenLabel = (() => {
    const parts: string[] = [];
    if (query.date === todayIso) parts.push(copy.when.today);
    else if (query.date === tomorrowIso) parts.push(copy.when.tomorrow);
    else if (query.date) parts.push(prettyDate(query.date));
    if (query.window !== "any") parts.push(TIME_WINDOWS[query.window].label);
    return parts.length ? parts.join(" · ") : null;
  })();

  const placeLabel = origin && !query.city ? copy.place.nearMe : query.city;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          // No backdrop-blur here on purpose: `backdrop-filter` creates a
          // stacking context, which would trap the open panel's z-index inside
          // this row and let the salon grid paint over it. The bar sits on the
          // cream canvas anyway, so the blur bought nothing.
          "bg-canvas-deep/70 rounded-slab-lg ring-hairline-soft flex flex-col gap-1 p-2 ring-1 ring-inset",
          "sm:flex-row sm:items-center sm:rounded-full sm:gap-0",
        )}
      >
        <SearchPanel
          icon={Search}
          label={copy.treatment.label}
          value={query.treatment}
          placeholder={copy.treatment.placeholder}
          open={open === "treatment"}
          onOpen={() => setOpen("treatment")}
          onClose={close}
        >
          <div className="flex flex-wrap gap-1.5 px-5 pt-4">
            <CountChip label={copy.counts.salons} value={index.salons.length} />
            <CountChip label={copy.counts.treatments} value={treatmentCount} />
            <CountChip
              label={copy.counts.professionals}
              value={index.professionals}
            />
          </div>

          <div className="max-h-[22rem] overflow-y-auto pb-2">
            <PanelOption
              active={!query.treatment}
              onSelect={() => {
                onQuery({ ...query, treatment: null, treatmentIsCategory: false });
                close();
              }}
            >
              {copy.treatment.anyLabel}
            </PanelOption>

            {index.groups.map((group) => (
              <div key={group.category}>
                <PanelHeading>{group.category}</PanelHeading>
                <PanelOption
                  active={query.treatmentIsCategory && query.treatment === group.category}
                  meta={`${group.salonCount}`}
                  onSelect={() => {
                    onQuery({
                      ...query,
                      treatment: group.category,
                      treatmentIsCategory: true,
                    });
                    close();
                  }}
                >
                  All {group.category.toLowerCase()}
                </PanelOption>
                {group.treatments.slice(0, 6).map((treatment) => (
                  <PanelOption
                    key={treatment.name}
                    active={!query.treatmentIsCategory && query.treatment === treatment.name}
                    meta={`${treatment.salonCount}`}
                    onSelect={() => {
                      onQuery({
                        ...query,
                        treatment: treatment.name,
                        treatmentIsCategory: false,
                      });
                      close();
                    }}
                  >
                    {treatment.name}
                  </PanelOption>
                ))}
              </div>
            ))}
          </div>
        </SearchPanel>

        <Divider />

        <SearchPanel
          icon={MapPin}
          label={copy.place.label}
          value={placeLabel}
          placeholder={copy.place.placeholder}
          open={open === "place"}
          onOpen={() => setOpen("place")}
          onClose={close}
        >
          <div className="py-2">
            <PanelOption
              active={Boolean(origin) && !query.city}
              onSelect={() => {
                onQuery({ ...query, city: null });
                onLocate();
                close();
              }}
            >
              <span className="inline-flex items-center gap-2.5">
                <LocateFixed className="text-rausch size-4" aria-hidden />
                {locating ? copy.place.locating : copy.place.nearMe}
              </span>
            </PanelOption>

            <PanelOption
              active={!query.city && !origin}
              onSelect={() => {
                onQuery({ ...query, city: null });
                close();
              }}
            >
              {copy.place.anyLabel}
            </PanelOption>

            {index.cities.map((city) => (
              <PanelOption
                key={city.name}
                active={query.city === city.name}
                meta={`${city.salonCount}`}
                onSelect={() => {
                  onQuery({ ...query, city: city.name });
                  close();
                }}
              >
                {city.name}
              </PanelOption>
            ))}
          </div>
        </SearchPanel>

        <Divider />

        <SearchPanel
          icon={CalendarDays}
          label={copy.when.label}
          value={whenLabel}
          placeholder={copy.when.placeholder}
          open={open === "when"}
          onOpen={() => setOpen("when")}
          onClose={close}
          align="right"
          width="w-[min(24rem,calc(100vw-2.5rem))]"
        >
          <div className="flex flex-wrap gap-1.5 px-5 pt-4">
            <PanelChip
              active={!query.date}
              onSelect={() => onQuery({ ...query, date: null })}
            >
              {copy.when.anyLabel}
            </PanelChip>
            <PanelChip
              active={query.date === todayIso}
              onSelect={() => onQuery({ ...query, date: todayIso })}
              hint={prettyDate(todayIso)}
            >
              {copy.when.today}
            </PanelChip>
            <PanelChip
              active={query.date === tomorrowIso}
              onSelect={() => onQuery({ ...query, date: tomorrowIso })}
              hint={prettyDate(tomorrowIso)}
            >
              {copy.when.tomorrow}
            </PanelChip>
          </div>

          <MonthGrid
            month={month}
            selected={query.date}
            todayIso={todayIso}
            onMonth={setMonth}
            onPick={(value) =>
              onQuery({ ...query, date: value === query.date ? null : value })
            }
          />

          <div className="border-hairline-soft border-t px-5 py-4">
            <p className="text-muted text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
              {copy.when.timeLabel}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <PanelChip
                active={query.window === "any"}
                onSelect={() => onQuery({ ...query, window: "any" })}
              >
                {copy.when.anyTime}
              </PanelChip>
              {(Object.keys(TIME_WINDOWS) as Exclude<TimeWindow, "any">[]).map(
                (key) => (
                  <PanelChip
                    key={key}
                    active={query.window === key}
                    onSelect={() => onQuery({ ...query, window: key })}
                    hint={TIME_WINDOWS[key].hint}
                  >
                    {TIME_WINDOWS[key].label}
                  </PanelChip>
                ),
              )}
            </div>
            {/* Says what the filter can actually do. */}
            <p className="text-muted-soft mt-3 text-[0.75rem] leading-relaxed">
              {copy.when.note}
            </p>
          </div>
        </SearchPanel>

        <div className="p-1 sm:pl-2">
          <Button
            variant="ink"
            arrow={false}
            onClick={close}
            className="w-full justify-center sm:w-auto"
          >
            {copy.submit}
          </Button>
        </div>
      </div>

      {locationError && (
        <p role="status" className="text-muted px-2 text-[0.8125rem]">
          {locationError}
        </p>
      )}
    </div>
  );
}

function Divider() {
  return (
    <span
      className="bg-hairline mx-1 hidden h-8 w-px shrink-0 sm:block"
      aria-hidden
    />
  );
}

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="bg-canvas text-body inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-medium">
      {label}
      <span className="text-muted tabular-nums">{value}</span>
    </span>
  );
}

/** Month view. Past days are disabled — you cannot book backwards. */
function MonthGrid({
  month,
  selected,
  todayIso,
  onMonth,
  onPick,
}: {
  month: Date;
  selected: string | null;
  todayIso: string;
  onMonth: (next: Date) => void;
  onPick: (value: string) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leading = first.getDay();

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(year, monthIndex, i + 1))),
  ];

  return (
    <div className="px-5 pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonth(new Date(year, monthIndex - 1, 1))}
          aria-label="Previous month"
          className="text-muted hover:text-ink hover:bg-canvas grid size-8 place-items-center rounded-full transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="text-[0.9375rem] font-semibold">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          onClick={() => onMonth(new Date(year, monthIndex + 1, 1))}
          aria-label="Next month"
          className="text-muted hover:text-ink hover:bg-canvas grid size-8 place-items-center rounded-full transition-colors"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-0.5">
        {DAY_INITIALS.map((initial, i) => (
          <span
            key={i}
            aria-hidden
            className="text-muted-soft grid h-7 place-items-center text-[0.6875rem] font-semibold"
          >
            {initial}
          </span>
        ))}
        {cells.map((value, i) =>
          value === null ? (
            <span key={`pad-${i}`} />
          ) : (
            <button
              key={value}
              type="button"
              disabled={value < todayIso}
              aria-pressed={value === selected}
              aria-label={prettyDate(value)}
              onClick={() => onPick(value)}
              className={cn(
                "grid h-9 place-items-center rounded-full text-[0.875rem] tabular-nums transition-colors",
                "disabled:text-muted-soft/50 disabled:pointer-events-none",
                value === selected
                  ? "bg-ink font-semibold text-white"
                  : value === todayIso
                    ? "ring-rausch/40 text-ink font-semibold ring-1 ring-inset hover:bg-canvas"
                    : "text-body hover:bg-canvas",
              )}
            >
              {Number(value.slice(-2))}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
