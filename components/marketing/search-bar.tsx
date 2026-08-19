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
import { search as copy } from "@/lib/marketing/content";
import type { SalonIndex } from "@/lib/marketing/salons";
import {
  TIME_WINDOWS,
  type Coords,
  type Query,
  type TimeWindow,
} from "@/lib/marketing/search";
import { cn } from "@/lib/marketing/utils";
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
      new Set(index.groups.flatMap((g) => g.treatments.map((t) => t.name)))
        .size,
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
      {/*
        **The signature element of the reference, and now of this page.**

        `search-bar-pill`: a white surface at 9999px radius and 64px tall, carrying
        the one shadow tier, divided into segments by vertical hairlines and
        terminated by a circular accent orb. Every measurement here comes from
        `../tho/DESIGN.md` — 64px bar, 48px orb, hairline dividers.

        It used to be a cream `rounded-slab-lg` tray with a black "Search" pill on
        the end. On a page whose canvas is now white, a cream tray reads as an
        unexplained second surface, and the black pill spent the strongest control
        on the page on the one action that fetches nothing.

        No `backdrop-blur` here on purpose: `backdrop-filter` creates a stacking
        context, which would trap the open panel's z-index inside this row and let
        the salon grid paint over it.
      */}
      <div
        className={cn(
          "bg-paper ring-hairline shadow-card flex flex-col gap-1 rounded-lg p-2 ring-1 ring-inset",
          "sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:py-0 sm:pr-2 sm:pl-2",
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
                onQuery({
                  ...query,
                  treatment: null,
                  treatmentIsCategory: false,
                });
                close();
              }}
            >
              {copy.treatment.anyLabel}
            </PanelOption>

            {index.groups.map((group) => (
              <div key={group.category}>
                <PanelHeading>{group.category}</PanelHeading>
                <PanelOption
                  active={
                    query.treatmentIsCategory &&
                    query.treatment === group.category
                  }
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
                    active={
                      !query.treatmentIsCategory &&
                      query.treatment === treatment.name
                    }
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
            <p className="text-muted text-caption-sm font-semibold tracking-[0.16em] uppercase">
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
            <p className="text-muted-soft mt-3 text-caption-sm leading-relaxed">
              {copy.when.note}
            </p>
          </div>
        </SearchPanel>

        {/*
          The `search-orb`. Circular and 48px from `sm` up, where it is the hottest
          single colour moment on the page; a full-width labelled pill below that,
          because a bare 48px circle at the foot of a stacked column of three
          segments reads as a decoration rather than the control that closes them.

          `sm:sr-only` keeps the word in the accessible name at every width, so the
          orb needs no `aria-label` that could drift from the visible label.
        */}
        <div className="p-1 sm:p-0 sm:pl-2">
          <button
            type="button"
            onClick={close}
            className={cn(
              "bg-rausch-cta hover:bg-rausch-cta-pressed text-title inline-flex h-12 w-full items-center justify-center gap-2 rounded-full font-medium text-white",
              "transition-colors duration-200 sm:size-12 sm:w-12 sm:shrink-0",
            )}
          >
            <Search className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
            <span className="sm:sr-only">{copy.submit}</span>
          </button>
        </div>
      </div>

      {locationError && (
        <p role="status" className="text-muted px-2 text-caption">
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
    // `bg-surface-soft`, not `bg-canvas`: the panel this sits in is paper white, so
    // a chip needs a step away from white. When the public pages were themselves white
    // this was the difference between a visible chip and an invisible one — canvas on
    // canvas. Same bug the option rows had, and the same fix outlives the cause.
    <span className="bg-surface-soft text-body inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption-sm font-medium">
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
    ...Array.from({ length: daysInMonth }, (_, i) =>
      iso(new Date(year, monthIndex, i + 1)),
    ),
  ];

  return (
    <div className="px-5 pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonth(new Date(year, monthIndex - 1, 1))}
          aria-label="Previous month"
          className="text-muted hover:text-ink hover:bg-surface-soft grid size-8 place-items-center rounded-full transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="text-title font-semibold">
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </p>
        <button
          type="button"
          onClick={() => onMonth(new Date(year, monthIndex + 1, 1))}
          aria-label="Next month"
          className="text-muted hover:text-ink hover:bg-surface-soft grid size-8 place-items-center rounded-full transition-colors"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-0.5">
        {DAY_INITIALS.map((initial, i) => (
          <span
            key={i}
            aria-hidden
            className="text-muted-soft grid h-7 place-items-center text-caption-sm font-semibold"
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
                "grid h-9 place-items-center rounded-full text-body-sm tabular-nums transition-colors",
                "disabled:text-muted-soft/50 disabled:pointer-events-none",
                value === selected
                  ? "bg-ink font-semibold text-white"
                  : value === todayIso
                    ? "ring-rausch/50 text-ink font-semibold ring-1 ring-inset hover:bg-surface-soft"
                    : "text-body hover:bg-surface-soft",
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
