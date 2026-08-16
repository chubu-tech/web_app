"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BusinessCard } from "@/components/ui/business-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { RatingPill } from "@/components/ui/rating";
import { formatKm, kmTo, type Coords } from "@/lib/discover-logic";
import { mapCenter, nearestTo, resolveLocation, THIMPHU_CENTER } from "@/lib/geo";
import { salonPath } from "@/lib/slug";
import { cardMetaLine, hasLocation, type Business } from "@/lib/types/salon";
import { cn } from "@/lib/utils";

/**
 * The Map tab, ported from `MapTab` in `tho/app/lib/customer/map_tab.dart`: a
 * full-bleed salon map under a floating search pill, with the selected salon's card
 * over the bottom.
 *
 * Everything except leaflet itself lives here, so the search field and the rail are
 * usable while the map's ~150 KB is still arriving.
 */
const SalonMap = dynamic(() => import("./salon-map").then((m) => m.SalonMap), {
  ssr: false,
  loading: () => <div className="bg-surface-soft h-full w-full" aria-hidden />,
});

/**
 * The viewer's explicit choice, **stamped with the query it was made under**.
 *
 * This is how `didUpdateWidget`'s rule (`map_view.dart:95`) is expressed without an
 * effect that resets state: keep the selection while it is still in the list, and
 * otherwise fall back to the nearest. Two things make the stamp necessary rather
 * than pretty:
 *
 * - `id: null` is a real state — tapping the basemap clears the card — and it has to
 *   be distinguishable from *"nothing chosen yet, use the nearest"*.
 * - But a cleared selection must **not** survive a new search. The Dart re-selects
 *   the nearest match whenever the list changes, including from null, so pinning the
 *   choice to its query reproduces that: a different query means no choice yet.
 */
type Choice = { query: string; id: string | null };

export function MapView({ salons }: { salons: Business[] }) {
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [fix, setFix] = useState<Coords>(THIMPHU_CENTER);

  /**
   * One location request, on mount, exactly as `MapTab.initState` does it. Never
   * rejects — a denied prompt, no sensor, a timeout and an implausible fix all
   * resolve to the Thimphu centre — so there is no error branch to render.
   */
  useEffect(() => {
    let live = true;
    resolveLocation().then((resolved) => {
      if (live) setFix(mapCenter(resolved));
    });
    return () => {
      live = false;
    };
  }, []);

  const located = useMemo(() => salons.filter(hasLocation), [salons]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (needle === "") return located;
    return located.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) ||
        (b.addressText ?? "").toLowerCase().includes(needle),
    );
  }, [located, needle]);

  // Derived, not stored — see `Choice`.
  const selectedId =
    choice && choice.query === query
      ? choice.id === null || filtered.some((b) => b.id === choice.id)
        ? choice.id
        : (nearestTo(fix, filtered)?.id ?? null)
      : (nearestTo(fix, filtered)?.id ?? null);

  const selected = filtered.find((b) => b.id === selectedId) ?? null;

  function select(id: string) {
    setChoice({ query, id });
  }

  return (
    <div className="flex h-full">
      {/* The desktop rail. New design work, not a port — the app is phone-only, and
          a 1400px map with one card in the corner wastes the room it has. Reducing a
          column below 1128 rather than reflowing these rows is the DESIGN.md rule. */}
      <aside className="border-hairline hidden w-[320px] shrink-0 flex-col overflow-y-auto border-r desktop:flex">
        <p className="text-caption text-muted px-base pt-base">
          {filtered.length} {filtered.length === 1 ? "salon" : "salons"} on the map
        </p>
        <ul className="p-base gap-xs flex flex-col">
          {filtered.map((b) => (
            <li key={b.id}>
              <RailRow
                business={b}
                from={fix}
                selected={b.id === selectedId}
                onSelect={() => select(b.id)}
              />
            </li>
          ))}
        </ul>
      </aside>

      <div className="relative min-w-0 flex-1">
        {filtered.length === 0 ? (
          <div className="grid h-full place-items-center">
            {/* Two states, kept apart as the app keeps them: an empty map is a
                platform fact, an empty search is something you can undo. */}
            {located.length === 0 ? (
              <EmptyState
                icon={Icons.map}
                title="No mapped salons"
                message="Salons appear on the map once they add a location."
              />
            ) : (
              <EmptyState
                icon={Icons.searchEmpty}
                title="No matches"
                message={`Nothing matches “${query.trim()}”.`}
                action={
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-title text-rausch-cta min-h-12 font-medium"
                  >
                    Clear search
                  </button>
                }
              />
            )}
          </div>
        ) : (
          <SalonMap
            salons={filtered}
            center={fix}
            selectedId={selectedId}
            onSelect={select}
            onClear={() => setChoice({ query, id: null })}
          />
        )}

        {/* Above leaflet's own panes, which climb to z-index 800. */}
        <div className="px-base pt-sm pointer-events-none absolute inset-x-0 top-0 z-[900]">
          <div className="border-hairline bg-canvas shadow-card px-base pointer-events-auto mx-auto flex max-w-[560px] items-center rounded-full">
            <Icons.search
              className="text-ink shrink-0"
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search on the map"
              aria-label="Search salons on the map"
              className="text-body-md text-ink placeholder:text-muted px-sm min-h-12 min-w-0 flex-1 bg-transparent outline-none"
            />
            {query !== "" ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-muted hover:text-ink flex size-8 shrink-0 items-center justify-center"
              >
                <Icons.close
                  style={{ width: IconSize.sm, height: IconSize.sm }}
                  aria-hidden
                />
              </button>
            ) : null}
          </div>
        </div>

        {selected ? (
          <div className="p-base absolute inset-x-0 bottom-0 z-[900]">
            <div className="mx-auto max-w-[560px]">
              <BusinessCard
                id={selected.id}
                name={selected.name}
                subtitle={selected.addressText ?? selected.description}
                imageUrl={selected.coverUrl}
                avgRating={selected.avgRating}
                reviewCount={selected.reviewCount}
                meta={cardMetaLine(selected)}
                sizes="(min-width: 744px) 560px, 100vw"
                // Keeps this preview's 150px banner. The browse ratio would make the
                // cover alone 373px tall at 560px wide, and this card floats over the
                // map it is describing.
                compact
                /* The one caller that keeps the border, the fill and the shadow. Every
                   other salon card is now bare image-and-text on the page canvas, which
                   is right on a page — and wrong here, where "the page" is a map: the
                   name and address would sit straight on the tiles with roads running
                   through them. */
                framed
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A rail row. A button that selects, with the name as a separate link to the salon —
 * selecting and opening are different intentions, and one row cannot be both without
 * nesting a link in a button.
 */
function RailRow({
  business,
  from,
  selected,
  onSelect,
}: {
  business: Business;
  from: Coords;
  selected: boolean;
  onSelect: () => void;
}) {
  const km = kmTo(business, from);
  return (
    <div
      className={cn(
        "gap-sm p-sm flex items-center rounded-sm border",
        selected ? "border-rausch bg-rausch/10" : "border-transparent hover:bg-surface-soft",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="min-w-0 flex-1 text-left"
      >
        <span className="text-title text-ink block truncate font-medium">
          {business.name}
        </span>
        <span className="text-caption text-muted gap-xs mt-xxs flex items-center">
          {business.reviewCount > 0 ? (
            <RatingPill rating={business.avgRating} count={business.reviewCount} />
          ) : null}
          {/* Unknown distance is never rendered as zero — `kmTo` returns null for a
              salon with no coordinates, though the rail only ever gets located ones. */}
          {km != null ? <span>{formatKm(km)}</span> : null}
        </span>
      </button>
      <Link
        href={salonPath(business)}
        aria-label={`Open ${business.name}`}
        className="text-muted hover:text-ink flex size-10 shrink-0 items-center justify-center"
      >
        <Icons.chevronRight
          style={{ width: IconSize.xs, height: IconSize.xs }}
          aria-hidden
        />
      </Link>
    </div>
  );
}
