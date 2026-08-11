"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BusinessCard } from "@/components/ui/business-card";
import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { Sheet } from "@/components/ui/sheet";
import { fetchServices, fetchServiceStaff, fetchStaff } from "@/lib/api/salon";
import { availableToday } from "@/lib/available-today";
import { formatKm, kmTo, nearestSalons, withinDistance } from "@/lib/discover-logic";
import { resolveLocation, type Fix } from "@/lib/geo";
import { rebookable, resolveRebook } from "@/lib/rebook";
import { rank, topRated } from "@/lib/recommendations";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_FILTERS,
  hasDistance,
  isActive as filtersActive,
  minDistanceKm,
  toParams,
  type SalonFilters,
} from "@/lib/salon-filters";
import {
  EMPTY_PRODUCT_FILTER,
  priceBounds,
  productFilterCount,
  productFilterIsActive,
  productFilterToParams,
  type ProductFilter,
} from "@/lib/product-filter";
import {
  cardMetaLine,
  type Business,
  type Category,
  type Offer,
  type Product,
  type SalonAvailability,
} from "@/lib/types/salon";
import type { Booking, WorkingHour } from "@/lib/types/booking";
import { cn } from "@/lib/utils";
import { FavouriteButton } from "./favourite-button";
import { FilterPanel } from "./filter-panel";
import { ProductFilterSheet } from "./product-filter-sheet";
import { ProductsBrowse } from "./products-browse";
import {
  AvailableTodayRow,
  BookAgainRow,
  NearbyRow,
  OffersRow,
  RecommendedRow,
  ServicesRow,
  TopRatedRow,
} from "./discover-rows";

/**
 * Discover, ported from `_Discovery` in
 * `tho/app/lib/customer/customer_home.dart:251`.
 *
 * The split with the server page is deliberate: **the URL is the filter state**, so
 * gender/category/price narrow the query server-side and a filtered view is
 * shareable — something the app cannot do. What stays here is what needs a browser:
 * the GPS fix, the search box, and the ranking, which is pure so it runs locally
 * with no second round trip.
 */
export function Discover({
  businesses,
  categories,
  hoursByBusiness,
  categoriesByBusiness,
  offers,
  favouriteIds,
  filters,
  products,
  productFilter,
  tab,
  availability,
  pastBookings,
}: {
  businesses: Business[];
  categories: Category[];
  hoursByBusiness: Record<string, WorkingHour[]>;
  categoriesByBusiness: Record<string, Set<string>>;
  offers: Offer[];
  favouriteIds: string[];
  filters: SalonFilters;
  /**
   * `salons_available_today`, or empty. Empty is the ordinary state for a signed-out
   * visitor — the RPC is revoked from `anon` — so the row is absent rather than broken.
   */
  availability: SalonAvailability[];
  /** The customer's own history, unfiltered. `rebookable` does the narrowing. */
  pastBookings: Booking[];
  /** Every buyable product, across every salon — the Products segment's whole catalogue. */
  products: Product[];
  /** From `?sort=&min=&max=`, already reconciled against the loaded bounds by the page. */
  productFilter: ProductFilter;
  /** From `?tab=`. Anything but `products` is the salon list. */
  tab: "salons" | "products";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  /**
   * Whether "All salons" is the full grid rather than the single row.
   *
   * Local state, not a URL parameter, and that is a deliberate departure from this
   * file's own rule that the URL is the filter state. A filter changes *which* salons
   * are on the page and so has to be shareable and reloadable; this changes how many of
   * the same set are on screen at once. Putting it in the URL would push a history entry
   * for a layout preference and make the back button undo a press that changed nothing
   * about what is being shown.
   */
  const [expanded, setExpanded] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  /**
   * The booking whose rebook is being resolved, if any.
   *
   * Non-null freezes **every** card in the Book again row, not just the pressed one. That is
   * the re-entrancy guard: without it an impatient second press starts an overlapping fetch
   * and pushes a second booking flow, which is the defect upstream fixed in `a25af1a`.
   */
  const [rebooking, setRebooking] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const location = fix?.coords ?? null;

  // The fix starts here, on mount — not lazily behind whichever section reads it
  // first. `customer_home.dart:304-313` records what that cost: typing a search
  // term before the sections had rendered left the location null for the rest of
  // the session, and the distance filter silently never applied.
  useEffect(() => {
    let live = true;
    resolveLocation().then((resolved) => {
      if (live) setFix(resolved);
    });
    return () => {
      live = false;
    };
  }, []);

  const favourites = useMemo(() => new Set(favouriteIds), [favouriteIds]);

  /** Write the filters into the URL; the server re-runs the query from there. */
  function apply(next: SalonFilters) {
    const params = new URLSearchParams(toParams(next));
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  }

  /**
   * Switch segment, and the product filter, through the URL.
   *
   * **The salon filters and the product filter are separate parameter sets and never mix.** A
   * customer who narrows salons by price and then switches to Products should not find the products
   * narrowed by a salon-side facet — so switching drops the other segment's params rather than
   * carrying them, which is also what keeps a shared link unambiguous about what it is showing.
   */
  function goToTab(next: "salons" | "products") {
    if (next === "salons") {
      router.push("/", { scroll: false });
      return;
    }
    const params = new URLSearchParams({ tab: "products", ...productFilterToParams(productFilter) });
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  function applyProducts(next: ProductFilter) {
    const params = new URLSearchParams({ tab: "products", ...productFilterToParams(next) });
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  const onProducts = tab === "products";
  // The range control spans what is actually loaded, so the bounds come from the catalogue rather
  // than from a constant nobody maintains.
  const bounds = useMemo(() => priceBounds(products), [products]);

  // Distance is applied here rather than server-side: there is no PostGIS, and the
  // coordinates are already in hand. Both thumbs, not just the far one — the control
  // presents a range, so "10–20 km" must not return the salon 500 m away.
  const inRange = useMemo(() => {
    if (!hasDistance(filters) || location == null) return businesses;
    return withinDistance(businesses, {
      from: location,
      minKm: minDistanceKm(filters) ?? 0,
      maxKm: filters.distance.end,
    });
  }, [businesses, filters, location]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      inRange.filter((b) => {
        if (filters.minRating != null && (b.avgRating ?? 0) < filters.minRating) {
          return false;
        }
        if (q.length === 0) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          (b.addressText ?? "").toLowerCase().includes(q)
        );
      }),
    [inRange, filters.minRating, q],
  );

  const ranked = useMemo(
    () =>
      rank({
        businesses: inRange,
        now: new Date(),
        userLocation: location,
        favoriteIds: favourites,
        hoursByBusiness,
        categoriesByBusiness,
      }),
    [inRange, location, favourites, hoursByBusiness, categoriesByBusiness],
  );

  const nearby = useMemo(
    () => (location ? nearestSalons(inRange, { from: location }) : []),
    [inRange, location],
  );

  /**
   * "Available today", ranked against the same salon set every other row uses.
   *
   * `inRange` rather than `businesses`, so the rating and distance filters narrow this row
   * too — upstream made the same correction in `5482b57` after shipping it fed by the
   * unfiltered list, which put salons the customer had filtered out back on the page.
   */
  const availableEntries = useMemo(
    () => availableToday(inRange, availability, { from: location, now: new Date() }),
    [inRange, availability, location],
  );

  /** How many salons have *any* answer, so "See all salons" is only offered when it leads on. */
  const availableTotal = useMemo(
    () =>
      availableToday(inRange, availability, {
        from: location,
        now: new Date(),
        limit: Number.MAX_SAFE_INTEGER,
      }).length,
    [inRange, availability, location],
  );

  const bookAgain = useMemo(() => rebookable(pastBookings), [pastBookings]);

  /**
   * Resolve a past booking against the salon's **current** menu, then open the flow there.
   *
   * The destination is not knowable before the press, which is why the card is a button:
   * a service may have been retired or the stylist may have left, and the customer has to
   * be told rather than dropped into a basket that quietly lost something.
   *
   * **It fails open.** If the salon's menu will not load there is nothing to resolve
   * against, so it navigates with the booking's own service ids and lets the wizard sort it
   * out — which it can, because the wizard already validates every id in the URL against the
   * real menu and roster on render and lands on the furthest reachable step. Losing the
   * *sentence* is a much smaller cost than refusing the rebook over a failed read.
   */
  async function startRebook(booking: Booking) {
    if (rebooking != null || !booking.businessId) return;
    const businessId = booking.businessId;
    setRebooking(booking.id);

    const bookedIds = (booking.items ?? [])
      .map((i) => i.serviceId)
      .filter((id): id is string => id != null);

    try {
      const supabase = createClient();
      const [menu, staff, staffByService] = await Promise.all([
        fetchServices(supabase, businessId),
        fetchStaff(supabase, businessId),
        fetchServiceStaff(supabase, businessId).catch(() => ({})),
      ]);

      const r = resolveRebook({ booking, menu, staff, staffByService });
      const params = new URLSearchParams();
      params.set("step", r.step);
      for (const s of r.services) params.append("service", s.id);
      if (r.staff) params.set("staff", r.staff.id);
      if (r.changeNote) params.set("changed", "1");
      router.push(`/salon/${businessId}/book?${params}`);
    } catch {
      const params = new URLSearchParams();
      for (const id of bookedIds) params.append("service", id);
      router.push(`/salon/${businessId}/book?${params}`);
    } finally {
      // Not cleared on success: the push is in flight and re-enabling the row mid-navigation
      // is exactly the second press this guard exists to stop. The component unmounts.
      setRebooking((current) => (current === booking.id ? null : current));
    }
  }

  /**
   * "0.4 km" per salon for the card's distance chip.
   *
   * Built here rather than off `nearby`, which looks like the same thing and is not:
   * `nearestSalons` takes a `limit` of 5, so leaning on it would have put a chip on
   * the five closest cards and left the rest bare. Absent from the map means
   * *unknown* — no fix yet, or a salon with no coordinates — and the card renders
   * nothing for it, which is the same distinction `kmTo` returns null for.
   */
  const distanceLabels = useMemo(() => {
    const out = new Map<string, string>();
    if (!location) return out;
    for (const b of businesses) {
      const km = kmTo(b, location);
      if (km != null) out.set(b.id, formatKm(km));
    }
    return out;
  }, [businesses, location]);

  const active = filtersActive(filters);
  // Sections show on the default browse view; a live search shows just results.
  const showSections = q.length === 0;

  /**
   * One salon, rendered identically by the row and by the grid.
   *
   * A local closure rather than a module-level component because it reads three things
   * that belong to this render — the resolved distances, the favourites set and the
   * heart's client island. Lifting it out would mean threading all three through props
   * at both call sites to keep them in step, and "keep them in step" is exactly what a
   * second copy of this JSX would eventually fail to do.
   */
  function SalonCard({ b }: { b: Business }) {
    return (
      <BusinessCard
        id={b.id}
        name={b.name}
        /*
          The gender filter travels with the link, so the booking flow's service step opens on
          the choice already made on Discover. `/salon/[id]` passes it straight through to the
          Book CTA and nothing on that page filters by it — the salon's whole menu is still
          shown, which is the app's behaviour too (`initialGender` reaches the flow, not the
          detail screen).
        */
        href={filters.gender !== "any" ? `/salon/${b.id}?gender=${filters.gender}` : undefined}
        subtitle={b.addressText ?? b.description}
        meta={cardMetaLine(b)}
        imageUrl={b.coverUrl}
        avgRating={b.avgRating}
        reviewCount={b.reviewCount}
        // Only once a fix has resolved, and only for a salon that has coordinates —
        // `kmTo` returns null otherwise, which means unknown and must not render as
        // "0.0 km". 2 of the 13 live salons have no location at all.
        distanceLabel={distanceLabels.get(b.id) ?? null}
        favourite={
          <FavouriteButton
            businessId={b.id}
            name={b.name}
            initial={favourites.has(b.id)}
          />
        }
      />
    );
  }

  return (
    /*
      No width cap. This container was centred and capped at 1440, which on a 1920px
      display left a 264px band of empty canvas down each side — measured — while the
      salon rows inside were clipped mid-card by the container they could not grow past.
      A browse grid is the one thing on this site that has more to show whenever there is
      more room, so the gutters are the whole constraint and the columns absorb the rest.

      The reading-measure caps elsewhere are a different thing and stay: the salon page
      holds 1440 because its left column is prose, and the forms hold 720. Width helps a
      grid of cards; it hurts a paragraph.
    */
    <div className="px-base w-full tablet:px-lg">
      <LocationHeader source={fix?.source ?? null} />

      {/*
        The two segments, as links in the URL rather than local state — so a Products view is
        shareable and the back button steps between them. The app's own IA: Products is a segment of
        home sharing this row's search and filter, not a destination of its own.
      */}
      <div className="gap-sm mt-md flex items-center">
        <h1 className="sr-only">{onProducts ? "Products" : "Salons"}</h1>
        <div
          className="bg-surface-soft p-xxs flex flex-1 rounded-full tablet:max-w-[280px]"
          role="tablist"
          aria-label="Browse salons or products"
        >
          {(
            [
              ["salons", "Salons"],
              ["products", "Products"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={(value === "products") === onProducts}
              onClick={() => goToTab(value)}
              className={cn(
                "text-title min-h-10 flex-1 rounded-full font-medium transition-colors duration-[var(--duration-fast)]",
                (value === "products") === onProducts
                  ? "bg-canvas text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <IconToggle
          icon={Icons.search}
          label={onProducts ? "Search products" : "Search salons"}
          pressed={searchOpen}
          onClick={() => {
            setSearchOpen((open) => {
              if (open) setQuery("");
              return !open;
            });
            // Focus after the field exists.
            requestAnimationFrame(() => searchInput.current?.focus());
          }}
        />
        {/* Scan, in the app's own position — an action beside search on the home surface
            (`customer_home.dart:72`). A `Link`, not a toggle: it goes to a route rather than
            opening something here, and the camera has no business being on this page. Hidden
            below `tablet` only if it ever crowds; at 390px this row is a segmented control plus
            three 48px buttons, which fits. */}
        <Link
          href="/scan"
          aria-label="Scan a salon's queue QR"
          className="text-ink hover:bg-surface-soft relative flex size-12 shrink-0 items-center justify-center rounded-full"
        >
          <Icons.qr style={{ width: IconSize.md, height: IconSize.md }} aria-hidden />
        </Link>
        {onProducts ? (
          <IconToggle
            icon={Icons.filter}
            label={
              productFilterIsActive(productFilter)
                ? `Filters (${productFilterCount(productFilter)} active)`
                : "Filters"
            }
            pressed={productFilterOpen}
            dot={productFilterIsActive(productFilter)}
            onClick={() => setProductFilterOpen(true)}
          />
        ) : (
          <IconToggle
            icon={Icons.filter}
            label={active ? "Filters (active)" : "Filters"}
            pressed={filterOpen}
            dot={active}
            onClick={() => setFilterOpen(true)}
            className="desktop:hidden"
          />
        )}
      </div>

      {searchOpen ? (
        <div className="border-hairline shadow-card mt-sm gap-sm px-base flex items-center rounded-full border">
          <Icons.search
            className="text-ink shrink-0"
            style={{ width: IconSize.sm, height: IconSize.sm }}
            aria-hidden
          />
          <input
            ref={searchInput}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search salons & barbers"
            aria-label="Search salons and barbers"
            className="text-body-md text-ink placeholder:text-muted min-h-12 flex-1 bg-transparent outline-none"
          />
        </div>
      ) : null}

      {onProducts ? (
        <div className="mt-lg">
          <ProductsBrowse
            products={products}
            query={query}
            filter={productFilter}
            onClearFilter={() => applyProducts(EMPTY_PRODUCT_FILTER)}
          />
        </div>
      ) : (
      <div className="gap-xl mt-lg flex items-start">
        {/* The filter rail, from 1128 up. Below that the same panel lives in a
            sheet — DESIGN.md's collapsing strategy, not two different forms. */}
        <aside className="border-hairline-soft hidden w-[280px] shrink-0 rounded-lg border desktop:block">
          <h2 className="text-display-sm text-ink px-base pt-base font-semibold">
            Filters
          </h2>
          <FilterPanel
            categories={categories}
            initial={filters}
            onApply={apply}
          />
        </aside>

        <div className="min-w-0 flex-1">
          {showSections ? (
            /* 48px between rows, up from 32. Four carousels and a grid stacked at
               `xl` read as one continuous strip of photographs — the gap has to be
               larger than the gap *inside* a row for the eye to group them, and
               `gap-lg` (24px) is now the gap between cards. */
            <div className="gap-xxl mb-xxl flex flex-col">
              <ServicesRow
                categories={categories}
                selectedId={filters.categoryId}
                onSelect={(id) => apply({ ...filters, categoryId: id })}
              />
              {/*
                Book again, first of the salon rows and above the browse.

                Most sessions in this category are a rebooking rather than a shopping trip,
                which is what earns it the position — and it renders nothing at all for a
                customer with no completed booking, so a first-time visitor sees the browse
                exactly as before.

                **The app's 2026-08-08 rework put this above the category row too**; here it
                stays below, because the two rows answer different questions and Services is
                how somebody with no history starts. That is the one place this deliberately
                keeps tho_web's order rather than adopting the app's.
              */}
              <BookAgainRow
                bookings={bookAgain}
                onRebook={startRebook}
                busyBookingId={rebooking}
              />
              {/* The first row on the page, so its first cover is the LCP element —
                  see `priority` on `SalonScroller`. */}
              <RecommendedRow ranked={ranked} priority />
              <NearbyRow nearby={nearby} />
              <OffersRow offers={offers} />
              {/* `total` is every rated salon in the current set, so the row knows whether
                  its 5 are all of them — `topRated`'s own filter, applied twice rather than
                  guessed at from a length. */}
              <TopRatedRow
                businesses={topRated(inRange)}
                total={inRange.filter((b) => b.avgRating != null).length}
              />
              {/* Last of the rows, as upstream has it: it is the most time-sensitive thing
                  on the page and the one worth arriving at after the browse has failed to
                  decide anything. Absent entirely for a signed-out visitor — the RPC is
                  revoked from `anon`. */}
              <AvailableTodayRow entries={availableEntries} total={availableTotal} />
            </div>
          ) : null}

          {/* "No salons yet" is a claim about the marketplace, so it may only be
              made when nothing has been filtered. `inRange` has already been
              narrowed by the distance filter — which drops every salon with no
              coordinates outright — and gender/price narrow a services join
              server-side that can legitimately match nothing. In either case the
              honest answer is "No matches". (`customer_home.dart:655-664`) */}
          {inRange.length === 0 && !active ? (
            <EmptyState
              icon={Icons.salon}
              title="No salons yet"
              message="New salons will appear here as they join."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Icons.searchEmpty}
              title="No matches"
              message={
                q.length > 0
                  ? `Nothing matches “${query.trim()}”.`
                  : "Try adjusting your filters."
              }
              action={
                active ? (
                  <Button variant="outlined" onClick={() => apply(EMPTY_FILTERS)}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <section>
              {showSections ? (
                <SectionHeader
                  title="All salons"
                  className="mb-base"
                  action={
                    /*
                      "View all" only when there is something the row is not showing.
                      A control that expands a row into a grid of the same salons is a
                      control that appears to do nothing, and with 13 live salons and a
                      rail taking 280px that is a reachable state, not a hypothetical.
                    */
                    visible.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        aria-expanded={expanded}
                        className="text-caption text-rausch-cta px-sm hover:bg-rausch/10 inline-flex min-h-11 items-center justify-center rounded-full font-medium transition-colors duration-[var(--duration-fast)]"
                      >
                        {expanded ? "Show less" : `View all ${visible.length}`}
                      </button>
                    ) : undefined
                  }
                />
              ) : null}

              {/*
                **A single row by default, the full grid on request.**

                This was always the grid, which made Discover four carousels and then a
                wall — on 13 salons at 1440 that is a fifth section three times taller
                than the four above it put together, and the sections stop reading as
                sections. One row matches them, and "View all" is the way to the rest,
                so nothing is lost and the page has an ending.

                **A search is always the grid.** Results are the whole answer, not a
                section of a browse page, and a row that hid 8 of 11 matches behind a
                sideways scroll would be hiding the thing that was asked for. That is
                what `showSections` already means, so it is the same condition.
              */}
              {showSections && !expanded ? (
                <Carousel label="All salons">
                  {visible.map((b, i) => (
                    <li
                      key={b.id}
                      className="w-[240px] shrink-0 snap-start motion-safe:animate-card-in tablet:w-[264px]"
                      style={
                        { "--i": i, animationDelay: "calc(var(--i) * 45ms)" } as React.CSSProperties
                      }
                    >
                      <SalonCard b={b} />
                    </li>
                  ))}
                </Carousel>
              ) : (
                /*
                  One auto-fill track at every width, replacing three fixed column
                  counts. The counts are now a consequence of a card's minimum width
                  rather than a list of breakpoints to keep in step with the rail, and
                  that is what makes the brief's targets reachable: a 268px floor puts 1
                  card per row below 768, 2-3 through the tablet band and 4 at 1280 on a
                  full-width grid, rising to 6 at 1920 — without a `min-` variant for
                  either of the two widths the brief names, neither of which is a
                  breakpoint this project has.

                  **This grid lands one column short of those numbers**, and the rail is
                  the whole reason: it takes 280px plus a 32px gap out of the row, so at
                  1280 there is 920px left and 3 cards is what fits at a premium size. 4
                  would be 218px each. The rail keeping its width was the previous ask,
                  so the column pays instead. `/saved` has no rail and hits the brief
                  exactly.
                */
                <ul className="gap-lg grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))]">
                  {visible.map((b, i) => (
                    <li
                      key={b.id}
                      className="motion-safe:animate-card-in"
                      style={
                        { "--i": i, animationDelay: "calc(var(--i) * 45ms)" } as React.CSSProperties
                      }
                    >
                      <SalonCard b={b} />
                    </li>
                  ))}
                </ul>
              )}

              {/*
                The route, offered **beside** the expand toggle rather than instead of it.

                `/salons` is what the app's "See all salons" opens, and it carries the two
                sort chips this section has never had. The header's "View all" is a web-only
                convenience that expands the row into a grid of the same salons in the same
                order — genuinely useful and not worth removing, but it answers a different
                question, so this is a second affordance rather than a replacement.

                Placed under the section, not in the header: every other `SectionHeader` on
                this page carries exactly one action, and a second control in one of them
                would be the odd row out.
              */}
              {showSections ? (
                <Link
                  href="/salons"
                  className="text-caption text-rausch-cta px-sm hover:bg-rausch/10 mt-base gap-xs inline-flex min-h-11 items-center rounded-full font-medium transition-colors duration-[var(--duration-fast)]"
                >
                  See all salons, sorted
                  <Icons.forward
                    style={{ width: IconSize.xxs, height: IconSize.xxs }}
                    aria-hidden
                  />
                </Link>
              ) : null}
            </section>
          )}
        </div>
      </div>
      )}

      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter"
      >
        <FilterPanel
          categories={categories}
          initial={filters}
          onApply={apply}
          onClose={() => setFilterOpen(false)}
        />
      </Sheet>

      <ProductFilterSheet
        open={productFilterOpen}
        onClose={() => setProductFilterOpen(false)}
        filter={productFilter}
        bounds={bounds}
        onApply={applyProducts}
      />
    </div>
  );
}

function IconToggle({
  icon: Icon,
  label,
  pressed,
  dot = false,
  onClick,
  className,
}: {
  icon: typeof Icons.search;
  label: string;
  pressed: boolean;
  dot?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "text-ink hover:bg-surface-soft relative flex size-12 items-center justify-center rounded-full",
        className,
      )}
    >
      <Icon style={{ width: IconSize.md, height: IconSize.md }} aria-hidden />
      {dot ? (
        <span className="bg-rausch absolute right-2.5 top-2.5 size-[7px] rounded-full" />
      ) : null}
    </button>
  );
}

/**
 * The location line, ported from `LocationHeader` (`home_sections.dart:15`).
 *
 * The app hardcodes `'Thimphu, Bhutan'`, which is defensible on a phone that only
 * shipped to Bhutan and a claim about the reader on a website. So this states the
 * one thing we actually know: **where the distances below are measured from.**
 *
 * It deliberately does *not* name a city from the data. The first attempt read the
 * `city` of the nearest salon, which looked more honest and was not: on 8 of the 13
 * live salons `city` contradicts the salon's own address — "Norzin Lam, Thimphu"
 * filed under Paro — so a viewer at the Thimphu centre was told "Paro, Bhutan". That
 * swapped the app's lie for a worse one.
 */
function LocationHeader({ source }: { source: "gps" | "fallback" | null }) {
  const label =
    source === "gps"
      ? "Near you"
      : source === "fallback"
        ? "Thimphu, Bhutan"
        : "Bhutan";

  return (
    <div className="pt-sm">
      <p className="text-caption-sm text-muted">
        {source === "fallback" ? "Showing distances from" : "Location"}
      </p>
      <p className="text-title text-ink mt-xxs gap-xs flex items-center font-medium">
        <Icons.location
          className="text-rausch shrink-0"
          style={{ width: IconSize.xxs, height: IconSize.xxs }}
          aria-hidden
        />
        {label}
      </p>
    </div>
  );
}
