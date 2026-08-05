"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessCard } from "@/components/ui/business-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { Sheet } from "@/components/ui/sheet";
import { nearestSalons, withinDistance } from "@/lib/discover-logic";
import { resolveLocation, type Fix } from "@/lib/geo";
import { rank, topRated } from "@/lib/recommendations";
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
import type { Business, Category, Offer, Product } from "@/lib/types/salon";
import type { WorkingHour } from "@/lib/types/booking";
import { cn } from "@/lib/utils";
import { FavouriteButton } from "./favourite-button";
import { FilterPanel } from "./filter-panel";
import { ProductFilterSheet } from "./product-filter-sheet";
import { ProductsBrowse } from "./products-browse";
import {
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
}: {
  businesses: Business[];
  categories: Category[];
  hoursByBusiness: Record<string, WorkingHour[]>;
  categoriesByBusiness: Record<string, Set<string>>;
  offers: Offer[];
  favouriteIds: string[];
  filters: SalonFilters;
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
  const [fix, setFix] = useState<Fix | null>(null);
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

  const active = filtersActive(filters);
  // Sections show on the default browse view; a live search shows just results.
  const showSections = q.length === 0;

  return (
    <div className="px-base mx-auto w-full max-w-[1440px] tablet:px-lg">
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
                "text-title min-h-10 flex-1 rounded-full font-medium transition-colors duration-[--duration-fast]",
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
        <aside className="border-hairline-soft hidden w-[280px] shrink-0 rounded-md border desktop:block">
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
            <div className="gap-xl mb-xl flex flex-col">
              <ServicesRow
                categories={categories}
                selectedId={filters.categoryId}
                onSelect={(id) => apply({ ...filters, categoryId: id })}
              />
              <RecommendedRow ranked={ranked} />
              <NearbyRow nearby={nearby} />
              <OffersRow offers={offers} />
              <TopRatedRow businesses={topRated(inRange)} />
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
              {showSections ? <SectionHeader title="All salons" /> : null}
              <ul className="gap-base grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-2 wide:grid-cols-3">
                {visible.map((b) => (
                  <li key={b.id}>
                    <BusinessCard
                      id={b.id}
                      name={b.name}
                      subtitle={b.addressText ?? b.description}
                      imageUrl={b.coverUrl}
                      avgRating={b.avgRating}
                      reviewCount={b.reviewCount}
                      sizes="(min-width: 1440px) 380px, (min-width: 744px) 44vw, 100vw"
                      favourite={
                        <FavouriteButton
                          businessId={b.id}
                          name={b.name}
                          initial={favourites.has(b.id)}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
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
