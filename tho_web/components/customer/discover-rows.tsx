"use client";

import Link from "next/link";
import { CardMedia } from "@/components/ui/card-media";
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
      <SectionHeader title="Services" className="mb-base" />
      <ul className="gap-lg flex overflow-x-auto pb-2">
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

/**
 * One horizontal row of salons.
 *
 * The items are deliberately **not** `BusinessCard`: they carry one coral badge
 * stating why the salon is in *this* row — its rank reason, its distance, its score —
 * where the browse card carries a rating and a heart. What they now share is
 * `CardMedia`, so the two agree on the frame, the radius and the hover zoom while
 * keeping their own semantics. They stay borderless too: a 5-item carousel of
 * lifting, shadowed cards would out-weigh the grid underneath it, which is the
 * section that matters.
 *
 * `mb-base` is passed to every header rather than left to `SectionHeader`'s own
 * default, which is 0 with an action and 8px without — so a row with a "View all"
 * link used to sit tighter to its cards than its neighbours did.
 */
function SalonScroller({
  title,
  items,
  seeAllHref,
  seeAllLabel = "View all",
}: {
  title: string;
  items: ScrollerItem[];
  seeAllHref?: string;
  seeAllLabel?: string;
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
      <ul className="gap-lg flex overflow-x-auto pb-2">
        {items.map(({ business: b, badge, meta }, i) => (
          <li
            key={b.id}
            className="w-[240px] shrink-0 motion-safe:animate-card-in tablet:w-[264px]"
            style={{ "--i": i, animationDelay: "calc(var(--i) * 45ms)" } as React.CSSProperties}
          >
            <article className="group relative">
              <CardMedia
                label={b.name}
                imageUrl={b.coverUrl}
                sizes="264px"
                className="rounded-lg"
                badge={
                  <span className="bg-rausch-cta text-on-primary text-caption-sm px-sm py-xxs shadow-card inline-flex items-center gap-1 rounded-full font-medium">
                    {badge}
                  </span>
                }
              />
              <h3 className="text-title text-ink mt-md truncate font-semibold">
                <Link
                  href={`/salon/${b.id}`}
                  className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {b.name}
                </Link>
              </h3>
              {meta ? (
                <p className="text-caption-sm text-muted mt-xxs truncate">{meta}</p>
              ) : null}
              {/* The focus indicator, on the article rather than on the name — same
                  reason as `BusinessCard`, where the whole story is written down. */}
              <span
                aria-hidden
                className="outline-ink pointer-events-none absolute -inset-2 rounded-lg outline-0 outline-offset-0 group-has-[a:focus-visible]:outline-2"
              />
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
      <SectionHeader title="Offers" className="mb-base" />
      {/* The one row that keeps its own cover geometry: a 92px banner in a 260px card
          is nothing like 16:10, and with 0 offers live platform-wide there is no way
          to look at a change here before shipping it. Spacing only. */}
      <ul className="gap-lg flex overflow-x-auto pb-2">
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
