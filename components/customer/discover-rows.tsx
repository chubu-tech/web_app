"use client";

import Link from "next/link";
import { BusinessCard, MediaChip } from "@/components/ui/business-card";
import { Carousel } from "@/components/ui/carousel";
import { CoverImage } from "@/components/ui/cover-image";
import { categoryIcon, Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { availableLabel, type AvailableSalon } from "@/lib/available-today";
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
 * — which matters, because **1 salon of the 14 approved has an offer** and 5 have no cover,
 * so an absent row is the ordinary state rather than the broken one. (Counted 2026-08-19;
 * `offers` was 0 platform-wide until 2026-08-18, so re-count before leaning on it.)
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
 *
 * **The "View all" is honest now, and it took a route to make it so.** This used to have none,
 * and the reason was sound: the ranking is computed *in this browser* from a GPS fix and a
 * favourites set, so a link to any server-rendered list would have shown a different order under
 * a heading promising more of these. `/recommended` closes that by running the identical `rank()`
 * call on the identical inputs with no `slice` — see `recommended-list.tsx`. The link is a
 * promise the route can keep, rather than one the row had to decline to make.
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
      // Only when the row is actually holding something back. With 9 rated salons and a rail
      // taking 280px, "View all 5 of 5" is a reachable state, not a hypothetical — the same
      // test "All salons" already applies to its own control.
      seeAllHref={ranked.length > limit ? "/recommended" : undefined}
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
        All three rows have a truthful "View all" now, and each leads somewhere that is the
        *same rule unbounded* rather than an approximation of it. This one is the 5 nearest
        salons and `/map` is every located salon around you.

        This comment used to explain why the other two could not have one, and both reasons
        were real: Recommended is ranked in the browser from a GPS fix, and `topRated` applies
        no rating floor so a link to a rating *filter* would have shown a different set. The
        answer was two routes that run the same functions — `/recommended` and `/top-rated` —
        not a link to something adjacent. Do not repoint either at a filtered Discover view.
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
 * "Offers" — the real live promotions, from `fetchLiveOffers`, and the **first** thing
 * on Discover.
 *
 * The read policy already filters to in-window offers, so this never re-checks dates.
 *
 * ## Why it is a banner and not a card
 *
 * Every other row on this page is a *browse*: five interchangeable salons, each card
 * answering the same question, and the row's job is to let the eye run along them. An
 * offer is the opposite — there is one live on the platform, it expires, and the thing
 * being sold is a **number**. Rendering it as a 260px salon card with a 92px cover strip
 * made the discount the smallest element on it and put the salon's photograph where the
 * price should have been.
 *
 * So the offer takes the full height of a banner and the cover becomes its *ground*: the
 * photograph goes behind a scrim, the discount is a stamped medallion, and the title is
 * set at display size over the top. It is the only surface in the customer shell where
 * text sits on a photograph, which is exactly why it reads as a promotion rather than as
 * another row of salons.
 *
 * ## Four animations, and each is answering something
 *
 * - **`offer-in`** staggers the banners in, 70ms apart — the same idea as `card-in` on the
 *   salon rows, slower and with a touch of scale, because a banner arriving is a bigger
 *   movement than a card arriving.
 * - **`offer-stamp`** lands the medallion after its own banner with `--ease-spring`'s
 *   overshoot, so the discount is the last thing to settle and therefore the thing the eye
 *   finishes on.
 * - **`offer-sheen`** passes one specular highlight diagonally across the cover, once. A
 *   sheen that loops is a casino; a sheen that runs once is a surface catching the light as
 *   it arrives.
 * - **`offer-drift`** is the only infinite one: a slow Ken Burns on the cover, so the top
 *   of Discover is not a still photograph. It is small enough (1.06 → 1.12 over 18s) that
 *   nothing moves out from under the type.
 *
 * All four are `motion-safe:`, and none can strand the banner mid-gesture: `both` fill plus
 * the app-wide reduced-motion rule resolves each to its finished state. See the block in
 * `globals.css` for why the drift is safe to truncate.
 *
 * **The scrim is not decoration.** `text-on-primary` over an owner-uploaded photograph has
 * no contrast guarantee at all — the file is as often a bright price list as a dark
 * interior — so the gradient is what makes the type legible, and it is drawn over the
 * monogram fallback too rather than only over a real cover.
 */
export function OffersRow({
  offers,
  priority = false,
}: {
  offers: Offer[];
  /**
   * Eager-load the **first** banner's cover.
   *
   * Passed by Discover only while there is an offer to draw, and `RecommendedRow` gives its
   * own up in exchange — the two rows swap the flag rather than both holding it, because two
   * eager covers compete for one connection and neither wins. See `SalonScroller`.
   */
  priority?: boolean;
}) {
  if (offers.length === 0) return null;
  return (
    <section>
      <SectionHeader
        title="Offers"
        className="mb-base"
        action={
          <span className="text-caption-sm text-muted gap-xs px-sm inline-flex items-center">
            <Icons.offer
              className="text-rausch-cta shrink-0"
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              aria-hidden
            />
            {offers.length === 1 ? "1 live deal" : `${offers.length} live deals`}
          </span>
        }
      />
      <Carousel label="Offers">
        {offers.map((o, i) => (
          <li
            key={o.id}
            className={cn(
              "motion-safe:animate-offer-in shrink-0 snap-start",
              /*
                **One offer fills the row; two or more become a rail.**

                This is the shape of the live data rather than a flourish: there is exactly
                one offer on the platform, and a 464px card parked in a 915px column reads as
                a rail whose other cards failed to load. A width is also the *only* thing that
                distinguishes them — same banner, same animations, same markup — so there is
                no second component to keep in step, and the second offer a salon publishes
                turns this into a carousel with nothing to change.
              */
              offers.length === 1
                ? "w-full"
                : "w-[288px] tablet:w-[420px] desktop:w-[464px]",
            )}
            style={{ "--i": i, animationDelay: "calc(var(--i) * 70ms)" } as React.CSSProperties}
          >
            <OfferBanner
              offer={o}
              index={i}
              solo={offers.length === 1}
              priority={priority && i === 0}
            />
          </li>
        ))}
      </Carousel>
    </section>
  );
}

/**
 * One offer, as a banner.
 *
 * `group` on the article is what drives the hover: the cover brightens, the banner lifts,
 * and the arrow slides. All three are `transition`s rather than animations, so they reverse
 * when the pointer leaves — an animation would have to be re-triggered and would jump on
 * the way out.
 *
 * The `<Link>` covers the whole banner through an `after:` pseudo-element rather than
 * wrapping it, which keeps the accessible name to the offer's own title while leaving the
 * medallion and the meta line as text rather than as part of a link label.
 */
function OfferBanner({
  offer: o,
  index,
  solo,
  priority,
}: {
  offer: Offer;
  /** Only for staggering the medallion behind its own banner. */
  index: number;
  /** The only offer, so it holds the whole width and can afford more height and type. */
  solo: boolean;
  priority: boolean;
}) {
  const ends = offerEndsLabel(o);

  return (
    <article
      className={cn(
        "group shadow-card relative isolate overflow-hidden rounded-lg",
        solo ? "h-[228px] tablet:h-[288px]" : "h-[200px] tablet:h-[232px]",
        "transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-expo)]",
        "motion-safe:hover:-translate-y-1",
      )}
    >
      {/*
        The ground. The pan lives on this wrapper rather than on `CoverImage`, whose own div
        is what `next/image`'s `fill` measures against — animating that would move the box
        the picture is being fitted into rather than the picture.

        **The overscan is in the keyframe and nowhere else.** A `scale-` utility carrying an
        arbitrary 1.06 here as well would not be belt and braces: Tailwind 4 emits that as
        the CSS `scale` property, which *composes* with the keyframe's `transform: scale(...)`
        rather than being overridden by it, so the pan would silently run 1.12 → 1.19. (Named
        without its bracket deliberately — a utility prefix followed by one is the comment
        that took the dev server down twice; see AGENTS.md.) Under reduced motion
        `motion-safe:` drops the animation entirely and the cover sits unscaled, which is the
        right still frame anyway.
      */}
      <div
        className="motion-safe:animate-offer-drift absolute inset-0 transition-[filter] duration-[var(--duration-slow)] group-hover:brightness-110"
        aria-hidden
      >
        <CoverImage
          label={o.businessName ?? o.title}
          imageUrl={o.businessCoverUrl}
          sizes={
            solo
              ? "(min-width: 1128px) 920px, (min-width: 744px) 700px, 100vw"
              : "(min-width: 1128px) 464px, (min-width: 744px) 420px, 288px"
          }
          priority={priority}
          className="size-full"
        />
      </div>

      {/*
        The scrim: dark at the foot where the type is, clear at the head where the medallion
        carries its own fill.

        **The stops are positioned, not spread evenly**, and that is the difference between a
        scrim and a tint. A plain three-colour gradient puts its midpoint at 50%, so the
        darkness needed under the title is spent halfway up the photograph — the type gets
        less than it needs and the picture gets more than it should. Front-loading it
        (90% → 55% by 35% → clear by 72%) keeps the top third of the cover as the photograph
        it is while guaranteeing the bottom third can carry white text over **any** upload,
        including the bright price lists owners actually post.
      */}
      <div
        className="from-obsidian/90 via-obsidian/55 absolute inset-0 bg-gradient-to-t from-0% via-35% to-transparent to-72%"
        aria-hidden
      />

      {/* The specular pass: a skewed white strip travelling across the cover once, on
          arrival. `-left-1/3` is where the keyframe starts it from, outside the clip. */}
      <div
        className="motion-safe:animate-offer-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
        aria-hidden
      />

      <div className="p-base tablet:p-lg relative flex h-full flex-col justify-between">
        <div className="gap-sm flex items-start justify-between">
          {o.discountPct != null ? (
            /* The medallion. `bg-rausch-cta` with `text-on-primary` — 4.89:1 — and never
               `bg-rausch`, which is 3.53:1 against white and fails AA. */
            <span
              className="motion-safe:animate-offer-stamp bg-rausch-cta text-on-primary shadow-card px-md py-xs flex shrink-0 flex-col items-center rounded-md"
              style={
                {
                  "--i": index,
                  animationDelay: "calc(var(--i) * 70ms + 220ms)",
                } as React.CSSProperties
              }
            >
              <span className="text-display-sm font-semibold">−{o.discountPct}%</span>
              <span className="text-badge font-medium uppercase">off</span>
            </span>
          ) : (
            /* An offer with no percentage still needs something in that corner, or the
               banner's top half is an empty photograph. `discount_pct` is nullable and the
               one live offer carries 30, so this branch has **no live example** — the same
               footing as `queueLockState`'s `needs_scan`. Look at it by nulling the column,
               not by trusting that it renders. */
            <span className="bg-paper/92 text-ink text-badge gap-xs px-md py-xs inline-flex shrink-0 items-center rounded-full font-semibold uppercase backdrop-blur-sm">
              <Icons.sparkle
                className="text-rausch-cta shrink-0"
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              Offer
            </span>
          )}

          {/* Urgency, and only when there is any: `offerEndsLabel` is null for an open-ended
              offer, and an empty pill would be worse than no pill. */}
          {ends ? (
            <span className="bg-obsidian/55 text-on-primary text-badge gap-xs px-sm py-xs inline-flex shrink-0 items-center rounded-full font-medium backdrop-blur-sm">
              <Icons.timer
                className="shrink-0"
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              {ends}
            </span>
          ) : null}
        </div>

        <div className="gap-xs flex flex-col">
          {/* The size goes on this wrapper and the colour on the heading inside it. Two
              `text-*` classes through one `cn` is what `lib/utils.ts` documents as remedy 1
              — `twMerge` treats `text-display-sm` and `text-on-primary` as one family and
              drops the loser, which is how a label on a photograph became a black box. */}
          <div className={solo ? "text-display-md tablet:text-display-lg" : "text-display-sm"}>
            <h3 className="text-on-primary line-clamp-2 font-semibold">
              <Link
                href={`/salon/${o.businessId}`}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {o.title}
              </Link>
            </h3>
          </div>

          <div className="gap-sm flex items-end justify-between">
            {/* The salon, and **not** the countdown a second time. It read
                "Norzin Salon & Spa · 6 days left" under a pill already saying "6 days left",
                and on a phone the duplicate was what pushed the salon's own name into an
                ellipsis — the one fact on the line a customer cannot get from anywhere else
                on the banner. Caught by looking at it at 390px, not by reading the join. */}
            {o.businessName ? (
              <p className="text-caption text-on-primary/85 min-w-0 flex-1 truncate">
                {o.businessName}
              </p>
            ) : null}
            {/* The affordance. A pill rather than a bare word, because the whole banner is
                the target and this is the only thing on it that says so. */}
            <span
              className={cn(
                "bg-paper/92 text-ink text-caption gap-xs px-md py-sm inline-flex shrink-0 items-center rounded-full font-medium backdrop-blur-sm",
                "group-hover:bg-paper transition-colors duration-[var(--duration-base)]",
              )}
            >
              View
              <Icons.forward
                className="shrink-0 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-expo)] group-hover:translate-x-1"
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * "Top rated salons" — rated salons only, best first.
 *
 * `total` is the count of *rated* salons in the whole set, which is what decides whether there
 * is anything behind "View all". The row itself only ever holds `topRated`'s default 5, so it
 * cannot work that out from `businesses.length`.
 */
export function TopRatedRow({
  businesses,
  total,
}: {
  businesses: Business[];
  total?: number;
}) {
  return (
    <SalonScroller
      title="Top rated salons"
      seeAllHref={(total ?? businesses.length) > businesses.length ? "/top-rated" : undefined}
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

/**
 * "Available today" — who can actually see you before the day is out.
 *
 * Upstream added this on 2026-08-08 (`home_sections.dart:747`) with a server RPC behind it,
 * and it answers a question no other row on Discover does: every other row ranks salons by
 * what they *are*, this one by **when they can take you**. That is what somebody standing on
 * the street at four o'clock is asking.
 *
 * The badge is the whole content — `availableLabel` renders either `Today 14:30` or
 * `Walk in · ~15 min`, so the card states its own answer. That is also what makes the mixed
 * ordering legible: a walk-in shop sorting ahead of a booked slot is accountable when both
 * cards say why.
 *
 * **Absent, not empty, for a signed-out visitor.** `salons_available_today` is revoked from
 * `anon`, so the caller passes an empty list and `SalonScroller` renders nothing. An
 * *empty* row under a heading promising availability would be a worse answer than no row.
 */
export function AvailableTodayRow({
  entries,
  total,
}: {
  entries: AvailableSalon[];
  /** Salons with an answer in the whole set, so "See all" is only offered when it leads somewhere. */
  total?: number;
}) {
  return (
    <SalonScroller
      title="Available today"
      seeAllHref={(total ?? entries.length) > entries.length ? "/salons" : undefined}
      seeAllLabel="See all salons"
      items={entries.map((entry) => ({
        business: entry.business,
        badge: (
          <>
            <Icons.clock
              className="shrink-0"
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              aria-hidden
            />
            {availableLabel(entry)}
          </>
        ),
      }))}
    />
  );
}
