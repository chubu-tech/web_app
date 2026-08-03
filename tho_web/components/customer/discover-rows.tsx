"use client";

import Link from "next/link";
import { CoverImage } from "@/components/ui/cover-image";
import { categoryIcon, Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { formatKm } from "@/lib/discover-logic";
import type { RankedSalon } from "@/lib/recommendations";
import { offerEndsLabel, type Business, type Category, type Offer } from "@/lib/types/salon";
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
      <SectionHeader title="Services" />
      <ul className="gap-base flex overflow-x-auto pb-1">
        {categories.map((c) => {
          const selected = c.id === selectedId;
          const Icon = categoryIcon(c.name);
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : c.id)}
                className="gap-xs flex w-16 flex-col items-center"
              >
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-full transition-colors duration-[--duration-fast]",
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
      </ul>
    </section>
  );
}

type ScrollerItem = {
  business: Business;
  /** The pill over the cover — the reason, the distance, the rating. */
  badge: React.ReactNode;
  /** The line under the name. */
  meta?: string | null;
};

function SalonScroller({
  title,
  items,
  seeAllHref,
}: {
  title: string;
  items: ScrollerItem[];
  seeAllHref?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeader
        title={title}
        action={
          seeAllHref ? (
            <Link
              href={seeAllHref}
              className="text-caption text-rausch-cta px-sm inline-flex min-h-11 min-w-11 items-center justify-center font-medium"
            >
              See all
            </Link>
          ) : undefined
        }
      />
      <ul className="gap-md flex overflow-x-auto pb-1">
        {items.map(({ business: b, badge, meta }) => (
          <li key={b.id} className="w-[200px] shrink-0 tablet:w-[220px]">
            <article className="relative">
              <div className="relative">
                <CoverImage
                  label={b.name}
                  imageUrl={b.coverUrl}
                  sizes="220px"
                  className="h-[110px] w-full rounded-md"
                />
                <span className="bg-rausch-cta text-on-primary text-caption-sm left-sm bottom-sm px-sm py-xxs absolute inline-flex items-center gap-1 rounded-full">
                  {badge}
                </span>
              </div>
              <h3 className="text-title text-ink mt-sm truncate font-medium">
                <Link
                  href={`/salon/${b.id}`}
                  className="after:absolute after:inset-0 after:content-['']"
                >
                  {b.name}
                </Link>
              </h3>
              {meta ? (
                <p className="text-caption-sm text-muted truncate">{meta}</p>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
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
}: {
  ranked: RankedSalon[];
  limit?: number;
}) {
  return (
    <SalonScroller
      title="Recommended for you"
      items={ranked.slice(0, limit).map((r) => ({
        business: r.business,
        badge: r.reason,
        meta: r.business.addressText,
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
      items={nearby.map(({ business, km }) => ({
        business,
        badge: (
          <>
            <Icons.location
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              aria-hidden
            />
            {formatKm(km)}
          </>
        ),
        meta: business.addressText,
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
      <SectionHeader title="Offers" />
      <ul className="gap-md flex overflow-x-auto pb-1">
        {offers.map((o) => (
          <li key={o.id} className="w-[260px] shrink-0">
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
      </ul>
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
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              className="fill-current"
              aria-hidden
            />
            {business.avgRating?.toFixed(1)}
          </>
        ),
        meta: business.addressText,
      }))}
    />
  );
}
