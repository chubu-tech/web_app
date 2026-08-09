"use client";

import Link from "next/link";
import { BusinessCard, MediaChip } from "@/components/ui/business-card";
import { Carousel } from "@/components/ui/carousel";
import { CoverImage } from "@/components/ui/cover-image";
import { categoryIcon, Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { formatKm } from "@/lib/discover-logic";
import type { RankedSalon } from "@/lib/recommendations";
import {
  cardMetaLine,
  offerEndsLabel,
  type Business,
  type Category,
  type Offer,
} from "@/lib/types/salon";
import { cn } from "@/lib/utils";

/**
 * The Discover sections, ported from `tho/app/lib/customer/home_sections.dart`.
 *
 * `PromoCarousel` is deliberately **not** ported: two hardcoded promos whose "Claim"
 * showed a snackbar and persisted nothing. `HomeOffersRow` shows real offers, so the
 * decorative one was only taking up the first screen.
 *
 * Each row renders nothing when it has no items, so Discover does not need to guard
 * — which matters, because today 0 salons have offers and 4 have no cover.
 *
 * **Every row is a `Carousel`.** They were each their own `flex overflow-x-auto pb-2`,
 * which drew a permanent grey scrollbar under all four on Windows and Linux. See that
 * component for what replaced it and why hiding a scrollbar is only half a change.
 */

/** "Services" — categories as tinted circles. Tapping toggles the category filter. */
export function ServicesRow({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Services" className="mb-base" />
      <Carousel label="Services">
        {categories.map((c) => {
          const selected = c.id === selectedId;
          const Icon = categoryIcon(c.name);
          return (
            <li key={c.id} className="snap-start">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : c.id)}
                className="gap-xs flex w-16 flex-col items-center"
              >
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)]",
                    selected ? "bg-rausch-cta" : "bg-rausch/10",
                  )}
                >
                  <Icon
                    style={{ width: IconSize.lg, height: IconSize.lg }}
                    className={selected ? "text-on-primary" : "text-rausch-cta"}
                    aria-hidden
                  />
                </span>
                <span
                  className={cn(
                    "text-caption-sm text-center",
                    selected ? "text-ink font-medium" : "text-muted",
                  )}
                >
                  {c.name}
                </span>
              </button>
            </li>
          );
        })}
      </Carousel>
    </section>
  );
}

type ScrollerItem = {
  business: Business;
  /** The pill over the cover's top-left — the reason, the distance, the rating. */
  badge: React.ReactNode;
};

/**
 * One horizontal row of salons.
 *
 * **These are `BusinessCard`s now**, where they used to be a near-copy of one. The old
 * comment gave two reasons for the copy and the redesign dissolved both: the row card
 * carried a coral badge stating why the salon is in *this* row, which is now just the
 * card's own top-left `chip` slot; and a carousel of lifting, shadowed cards would have
 * out-weighed the grid underneath it, which stopped being true when the frame and the
 * lift came off. One card, one set of measurements, on every surface that shows a salon.
 *
 * The badge is `MediaChip` rather than a coral pill — same reason `BusinessCard` gives
 * for the distance chip. A saturated coral pill in the corner of every cover was the
 * loudest thing on Discover, competing with five photographs for the same attention.
 *
 * `mb-base` is passed to every header rather than left to `SectionHeader`'s own default,
 * which is 0 with an action and 8px without — so a row with a "View all" link used to sit
 * tighter to its cards than its neighbours did.
 */
function SalonScroller({
  title,
  items,
  seeAllHref,
  seeAllLabel = "View all",
  priority = false,
}: {
  title: string;
  items: ScrollerItem[];
  seeAllHref?: string;
  seeAllLabel?: string;
  /**
   * Eager-load this row's **first** cover.
   *
   * Only the top row passes it, and only its first card takes it. Measured on the
   * production build: Discover's LCP was that card at **1564ms**, and it was
   * `loading="lazy"` — so the browser could not begin fetching the largest element on
   * the page until layout had run and told it the card was in view. `priority` makes it
   * a preload instead.
   *
   * Deliberately *not* every row: four eager covers would compete with each other for
   * the same connection and push the one that matters back down the queue, which is the
   * failure mode `priority` exists to fix.
   */
  priority?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeader
        title={title}
        className="mb-base"
        action={
          seeAllHref ? (
            <Link
              href={seeAllHref}
              className="text-caption text-rausch-cta px-sm hover:bg-rausch/10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full font-medium transition-colors duration-[var(--duration-fast)]"
            >
              {seeAllLabel}
            </Link>
          ) : undefined
        }
      />
      <Carousel label={title}>
        {items.map(({ business: b, badge }, i) => (
          <li
            key={b.id}
            className="w-[240px] shrink-0 snap-start motion-safe:animate-card-in tablet:w-[264px]"
            style={{ "--i": i, animationDelay: "calc(var(--i) * 45ms)" } as React.CSSProperties}
          >
            <BusinessCard
              id={b.id}
              name={b.name}
              subtitle={b.addressText}
              meta={cardMetaLine(b)}
              imageUrl={b.coverUrl}
              avgRating={b.avgRating}
              reviewCount={b.reviewCount}
              chip={<MediaChip>{badge}</MediaChip>}
              sizes="264px"
              priority={priority && i === 0}
            />
          </li>
        ))}
      </Carousel>
    </section>
  );
}

/**
 * "Recommended for you" — the recommendation engine's order, each card carrying its
 * `reason` so the ranking is legible rather than mysterious.
 */
export function RecommendedRow({
  ranked,
  limit = 5,
  priority = false,
}: {
  ranked: RankedSalon[];
  limit?: number;
  /** The top row on Discover, so its first cover is the page's LCP. */
  priority?: boolean;
}) {
  return (
    <SalonScroller
      priority={priority}
      title="Recommended for you"
      items={ranked.slice(0, limit).map((r) => ({
        business: r.business,
        badge: r.reason,
      }))}
    />
  );
}

/**
 * "Nearby salons" — **distance only**, deliberately. Recommended above already
 * blends rating, history and availability, so a second ranked signal here would
 * just be a worse copy of it.
 */
export function NearbyRow({
  nearby,
}: {
  nearby: { business: Business; km: number }[];
}) {
  return (
    <SalonScroller
      title="Nearby salons"
      /*
        The only one of the three rows with a truthful "View all", and the reason is
        worth stating so nobody adds the other two out of symmetry. This row is the 5
        nearest salons and `/map` is every located salon around you, so it really is
        the same list unbounded. "Recommended for you" has no route that ranks — the
        ranking is computed in this browser from a GPS fix and a favourites set — and
        `topRated` applies no rating floor at all, it just sorts and takes 5, so a link
        to a rating filter would quietly show a *different* set of salons under a
        heading that promised more of these.
      */
      seeAllHref="/map"
      seeAllLabel="View map"
      items={nearby.map(({ business, km }) => ({
        business,
        badge: (
          <>
            <Icons.location
              className="text-rausch-cta shrink-0"
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              aria-hidden
            />
            {formatKm(km)}
          </>
        ),
      }))}
    />
  );
}

/**
 * "Offers" — the real live promotions, from `fetchLiveOffers`.
 *
 * The read policy already filters to in-window offers, so this never re-checks
 * dates. Zero salons have one today, so it renders nothing; that is the same
 * behaviour as the app rather than an empty heading.
 */
export function OffersRow({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Offers" className="mb-base" />
      {/* The one row that keeps its own cover geometry: a 92px banner in a 260px card
          is nothing like the browse ratio, and with 0 offers live platform-wide there is
          no way to look at a change here before shipping it. Spacing only. */}
      <Carousel label="Offers">
        {offers.map((o) => (
          <li key={o.id} className="w-[260px] shrink-0 snap-start">
            <article className="border-hairline-soft shadow-card relative overflow-hidden rounded-md border">
              <CoverImage
                label={o.businessName ?? o.title}
                imageUrl={o.businessCoverUrl}
                sizes="260px"
                className="h-[92px] w-full"
              />
              <div className="p-md">
                <div className="gap-sm flex items-start">
                  <h3 className="text-title text-ink flex-1 truncate font-medium">
                    <Link
                      href={`/salon/${o.businessId}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {o.title}
                    </Link>
                  </h3>
                  {o.discountPct != null ? (
                    <span className="bg-rausch/10 text-rausch-cta text-badge px-sm py-xxs shrink-0 rounded-full font-semibold">
                      -{o.discountPct}%
                    </span>
                  ) : null}
                </div>
                <p className="text-caption-sm text-muted truncate">
                  {[o.businessName, offerEndsLabel(o)].filter(Boolean).join(" · ")}
                </p>
              </div>
            </article>
          </li>
        ))}
      </Carousel>
    </section>
  );
}

/** "Top rated salons" — rated salons only, best first. */
export function TopRatedRow({ businesses }: { businesses: Business[] }) {
  return (
    <SalonScroller
      title="Top rated salons"
      items={businesses.map((business) => ({
        business,
        badge: (
          <>
            <Icons.star
              className="text-star shrink-0 fill-current"
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              aria-hidden
            />
            {business.avgRating?.toFixed(1)}
          </>
        ),
      }))}
    />
  );
}
