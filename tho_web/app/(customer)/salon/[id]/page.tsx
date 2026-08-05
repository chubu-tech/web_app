import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FavouriteButton } from "@/components/customer/favourite-button";
import { MessageSalonButton } from "@/components/customer/message-salon-button";
import { SalonBooking } from "@/components/customer/salon-booking";
import { LoyaltyCard } from "@/components/customer/loyalty-card";
import { SalonShop } from "@/components/customer/salon-shop";
import { SalonTabs } from "@/components/customer/salon-tabs";
import { ShareButton } from "@/components/customer/share-button";
import { WalkInCard } from "@/components/customer/walk-in-card";
import { CoverImage } from "@/components/ui/cover-image";
import {
  ActionCircle,
  HeroCircleButton,
  IconLine,
  SpecialistCard,
} from "@/components/ui/detail-bits";
import { Icons, IconSize } from "@/components/ui/icons";
import { PhotoCollage, PhotoStrip } from "@/components/ui/photo-gallery";
import { RatingPill, StarBar } from "@/components/ui/rating";
import { SectionHeader } from "@/components/ui/section-header";
import {
  fetchBusinessById,
  fetchBusinessCategoryIds,
  fetchBusinessHours,
  fetchCategories,
} from "@/lib/api/discovery";
import { fetchMyFavouriteIds } from "@/lib/api/favourites";
import {
  fetchBusinessPhotos,
  fetchOffersForBusiness,
  fetchProductsForBusiness,
  fetchReviews,
  fetchServices,
  fetchServiceStaff,
  fetchStaff,
} from "@/lib/api/salon";
import { fetchLoyaltyBalance } from "@/lib/api/owner-back-office";
import { fetchPublicLoyaltyProgram, fetchPublicRewards } from "@/lib/api/shop";
import { fetchActiveLine } from "@/lib/api/queue";
import { coverageLine, dayName, hhmm, todayHoursLine } from "@/lib/salon-copy";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { QueueEntry } from "@/lib/types/queue";
import { hasLocation, offerEndsLabel, runsQueue, travels } from "@/lib/types/salon";
import type { Review } from "@/lib/types/salon";
import { whatsappUrl } from "@/lib/whatsapp";

/**
 * The salon page, ported from
 * `tho/app/lib/customer/business_detail_screen.dart`.
 *
 * **Every optional piece is caught on its own.** The gallery, the category line, the
 * products, the offers — none of them may take the page down, which is what
 * `business_detail_screen.dart:104-144` does with a `try` per fetch. That matters
 * more here than in the app: 12 of 13 live salons have no gallery and 12 have no
 * products, so the missing-data path *is* the normal path.
 *
 * All of it is anon-readable, so the whole page renders for a visitor with no
 * session — which is what a shared link or a QR scan gets.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const business = await fetchBusinessById(supabase, id).catch(() => null);
  if (!business) return { title: "Salon" };
  return {
    title: business.name,
    description:
      business.description ??
      `Book a chair at ${business.name}${business.addressText ? ` — ${business.addressText}` : ""}.`,
  };
}

export default async function SalonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();

  const business = await fetchBusinessById(supabase, id);
  if (!business) notFound();

  const [
    services,
    staff,
    hours,
    reviews,
    photos,
    categoryNames,
    products,
    offers,
    favouriteIds,
    staffByService,
  ] = await Promise.all([
    fetchServices(supabase, id),
    fetchStaff(supabase, id),
    fetchBusinessHours(supabase, id),
    fetchReviews(supabase, id).catch(() => []),
    fetchBusinessPhotos(supabase, id).catch(() => []),
    // The category line is decorative; two reads to render it, neither critical.
    (async () => {
      try {
        const [ids, all] = await Promise.all([
          fetchBusinessCategoryIds(supabase, id),
          fetchCategories(supabase),
        ]);
        return all.filter((c) => ids.has(c.id)).map((c) => c.name);
      } catch {
        return [] as string[];
      }
    })(),
    fetchProductsForBusiness(supabase, id).catch(() => []),
    fetchOffersForBusiness(supabase, id).catch(() => []),
    fetchMyFavouriteIds(supabase).catch(() => new Set<string>()),
    // Which stylist can do which service. Not decorative: an incompatible pair is
    // refused by `create_booking`, so the picker must not offer one.
    fetchServiceStaff(supabase, id).catch(() => ({}) as Record<string, string[]>),
  ]);

  /**
   * The walk-in line, read once for the card's badge — and **only** for a salon that
   * actually runs a queue, so 10 of the 13 live salons don't pay for an RPC whose card
   * never renders. `queue_active_line` is revoked from `anon`, so this legitimately
   * fails for a signed-out visitor; `null` reaches the badge as "Wait unknown" rather
   * than a fabricated zero.
   */
  const [account, queueLine, loyaltyProgram] = await Promise.all([
    getAccount(),
    runsQueue(business)
      ? fetchActiveLine(supabase, id).catch(() => null as QueueEntry[] | null)
      : Promise.resolve(null),
    // Null for a salon with no programme *or* a switched-off one, since
    // `loyalty_programs_select_public` admits only `is_active` — so the card can be included
    // unconditionally and simply renders nothing. Decorative: loyalty must not take the page down.
    fetchPublicLoyaltyProgram(supabase, id).catch(() => null),
  ]);

  /**
   * The rewards menu and the caller's balance, read only when there is a programme to read them for.
   *
   * The menu is public (`loyalty_rewards_select_public`) and the balance is not — `loyalty_balance`
   * raises `28000` without a session — so a visitor sees what is on offer and no number. That split
   * is the point: the rewards are the advertisement.
   */
  const [loyaltyRewards, loyaltyBalance] = loyaltyProgram
    ? await Promise.all([
        fetchPublicRewards(supabase, id).catch(() => []),
        account.state === "registered"
          ? fetchLoyaltyBalance(supabase, id, account.user.id).catch(() => null)
          : Promise.resolve(null),
      ])
    : [[], null];

  const isTravelling = travels(business);
  const wa = whatsappUrl(
    business.whatsappPhone,
    `Hi ${business.name}, I found you on Tho.`,
  );
  const saved = favouriteIds.has(id);
  const initialTab = Array.isArray(tab) ? tab[0] : tab;

  // The app's first tab is Services — the service and stylist picker. On the web
  // that lives in the rail beside these tabs instead, because at 1128 and up there
  // is room for the choice and the content at once, and hiding the primary action
  // behind a tab on a wide screen is a phone constraint. The remaining tabs keep the
  // app's order.
  //
  // **Shop arrives with 2f**, and only when there is something on the shelf — the condition
  // `SalonTabs` was written for ("Shop only exists when the salon has in-stock products", which is
  // why it keys on the label and never on an index). A tab announcing an empty shop would be the
  // dead end the earlier note refused to ship.
  const tabs = [
    ...(products.length > 0
      ? [
          {
            label: "Shop",
            content: <SalonShop products={products} salonName={business.name} />,
          },
        ]
      : []),
    { label: "Specialists", content: <Specialists staff={staff} /> },
    { label: "Reviews", content: <Reviews reviews={reviews} /> },
    {
      label: "About",
      content: <About business={business} hours={hours} productCount={products.length} />,
    },
  ];

  return (
    <div>
      {/* Hero — full-bleed above the two columns. */}
      <div className="relative">
        <CoverImage
          label={business.name}
          imageUrl={business.coverUrl}
          sizes="100vw"
          priority
          className="h-[220px] w-full tablet:h-[300px] desktop:h-[360px]"
        />
        <div className="px-base pt-base gap-sm absolute inset-x-0 top-0 flex tablet:px-lg">
          <HeroCircleButton icon={Icons.back} label="Back to Discover" href="/" />
          <span className="flex-1" />
          <ShareButton name={business.name} variant="hero" />
          <FavouriteButton
            businessId={id}
            name={business.name}
            initial={saved}
            variant="hero"
          />
        </div>
        {business.avgRating != null ? (
          <span className="bg-canvas shadow-card left-base bottom-base px-md py-xs absolute rounded-full tablet:left-lg">
            <RatingPill rating={business.avgRating} count={business.reviewCount} />
          </span>
        ) : null}
      </div>

      {/* A grid rather than a flex row, so the picker can sit in a different place
          at each breakpoint from one instance in the DOM:

            <744..1128   info → picker → tabs   (the action before the reading)
            ≥1128        info + tabs on the left, picker a sticky rail on the right

          Flex could not do this — the tabs are nested inside the left column, so
          `order` cannot move the picker between them. Grid rows can. */}
      <div className="px-base py-lg gap-xl mx-auto grid max-w-[1440px] grid-cols-1 tablet:px-lg desktop:grid-cols-[minmax(0,1fr)_380px]">
        <div className="row-start-1 min-w-0 desktop:col-start-1">
          <h1 className="text-display-lg text-ink font-medium">{business.name}</h1>
          {categoryNames.length > 0 ? (
            <p className="text-body-sm text-muted mt-xxs">{categoryNames.join(", ")}</p>
          ) : null}

          <div className="mt-sm gap-xxs flex flex-col">
            {/* A travelling stylist gets a coverage line, not a shopfront address —
                "Norzin Lam" would send the customer to a building that has nothing
                to do with them. */}
            {isTravelling ? (
              <IconLine icon={Icons.nearMe}>{coverageLine(business)}</IconLine>
            ) : null}
            {business.addressText ? (
              <IconLine icon={Icons.location}>{business.addressText}</IconLine>
            ) : null}
            <IconLine icon={Icons.clock}>{todayHoursLine(hours)}</IconLine>
          </div>

          <div className="gap-base mt-lg flex overflow-x-auto pb-1">
            {/* Message leads, as it does in the app: it is the one channel that stays
                inside the product and that the salon sees in its own inbox. */}
            <MessageSalonButton businessId={id} />
            {wa ? (
              <ActionCircle icon={Icons.send} label="WhatsApp" href={wa} external />
            ) : null}
            {business.phone ? (
              <ActionCircle
                icon={Icons.phone}
                label="Call"
                href={`tel:${business.phone.replace(/\s/g, "")}`}
              />
            ) : null}
            {/* No shopfront to route to for a travelling stylist, and no pin for a
                salon that never set one. */}
            {!isTravelling && hasLocation(business) ? (
              <ActionCircle
                icon={Icons.nearMe}
                label="Directions"
                href={`https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`}
                external
              />
            ) : null}
            <ShareButton name={business.name} variant="action" />
          </div>

          {/* Straight after the contact actions and before the reading, matching
              `business_detail_screen.dart:343`. If the shop takes walk-ins and you
              are standing outside it, that is the faster of the two paths. */}
          {runsQueue(business) ? (
            <WalkInCard
              business={business}
              services={services}
              staff={staff}
              initialLine={queueLine}
              hasSession={account.user != null}
            />
          ) : null}

          {offers.length > 0 ? (
            <section className="mt-lg">
              <SectionHeader title="Offers" />
              <ul className="gap-sm flex flex-col">
                {offers.map((o) => (
                  <li
                    key={o.id}
                    className="border-hairline-soft p-base gap-md flex items-center rounded-md border"
                  >
                    <Icons.offer
                      className="text-rausch shrink-0"
                      style={{ width: IconSize.sm, height: IconSize.sm }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-title text-ink font-medium">{o.title}</p>
                      {o.description ? (
                        <p className="text-body-sm text-muted">{o.description}</p>
                      ) : null}
                      {offerEndsLabel(o) ? (
                        <p className="text-caption-sm text-muted">{offerEndsLabel(o)}</p>
                      ) : null}
                    </div>
                    {o.discountPct != null ? (
                      <span className="bg-rausch/10 text-rausch-cta text-badge px-sm py-xxs shrink-0 rounded-full font-semibold">
                        -{o.discountPct}%
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {photos.length > 0 ? (
            <section className="mt-lg">
              <SectionHeader title="Photos" />
              <PhotoCollage urls={photos.map((p) => p.url)} />
            </section>
          ) : null}

        </div>

        {/* The picker and the CTA. Row 2 on a phone — between the salon's details
            and the tabs, so the primary action comes before the reading, which is
            where the app puts it too (its first tab *is* the picker). A sticky rail
            in column 2 from 1128 up. One instance either way: two radio groups
            sharing a `name` would fight.

            The bottom padding clears the fixed CTA bar plus the tab bar under it,
            so the last stylist is never hidden behind them. */}
        <aside className="border-hairline-soft p-base row-start-2 rounded-md border pb-[calc(140px+env(safe-area-inset-bottom))] desktop:col-start-2 desktop:row-start-1 desktop:row-span-2 desktop:sticky desktop:top-20 desktop:self-start desktop:pb-base">
          <SalonBooking
            salonId={id}
            services={services}
            staff={staff}
            staffByService={staffByService}
          />
        </aside>

        <div className="row-start-3 min-w-0 desktop:col-start-1 desktop:row-start-2">
          <SalonTabs tabs={tabs} initial={initialTab} />

          {/* Below the tabs, not inside one: the app puts it on the salon body for the same
              reason — points are a fact about your relationship with the salon, not a category of
              its content, and burying them in a tab would hide the one thing that brings a
              customer back. Renders nothing without an active programme. */}
          <LoyaltyCard
            businessId={id}
            program={loyaltyProgram}
            rewards={loyaltyRewards}
            balance={loyaltyBalance}
            signedIn={account.state === "registered"}
            isGuest={account.state === "guest"}
          />
        </div>
      </div>
    </div>
  );
}

function Specialists({
  staff,
}: {
  staff: { id: string; displayName: string; role: string; photoUrl: string | null }[];
}) {
  if (staff.length === 0) {
    return <p className="text-body-sm text-muted">No stylists listed yet.</p>;
  }
  // `href` at last — 2e landed `/stylist/[id]`, which is the reason `SpecialistCard`
  // was written with an optional one rather than being a link from the start.
  return (
    <ul className="gap-md grid grid-cols-2 tablet:grid-cols-3">
      {staff.map((s) => (
        <li key={s.id}>
          <SpecialistCard
            name={s.displayName}
            role={s.role}
            photoUrl={s.photoUrl}
            href={`/stylist/${s.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

function Reviews({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return <p className="text-body-sm text-muted">No reviews yet.</p>;
  }
  return (
    <ul className="gap-sm flex flex-col">
      {reviews.map((r) => (
        <li key={r.id} className="border-hairline p-base rounded-md border">
          <div className="gap-md flex items-center justify-between">
            <StarBar rating={r.rating} size={20} />
            <time
              dateTime={r.createdAt.toISOString()}
              className="text-caption-sm text-muted"
            >
              {r.createdAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
          </div>
          {r.body ? <p className="text-body-sm text-body mt-xs">{r.body}</p> : null}
          {r.photoUrls.length > 0 ? (
            <div className="mt-sm">
              <PhotoStrip urls={r.photoUrls} size={72} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function About({
  business,
  hours,
  productCount,
}: {
  business: { description: string | null; phone: string | null };
  hours: { id: string; dayOfWeek: number; startTime: string; endTime: string }[];
  productCount: number;
}) {
  return (
    <div className="gap-lg flex flex-col">
      {business.description ? (
        <p className="text-body-md text-body">{business.description}</p>
      ) : null}

      {productCount > 0 ? (
        <p className="text-body-sm text-muted">
          This salon sells {productCount} product{productCount === 1 ? "" : "s"} in
          person.
        </p>
      ) : null}

      {hours.length > 0 ? (
        <section>
          <SectionHeader title="Opening hours" as="h3" />
          <dl className="gap-xs grid grid-cols-[6rem_1fr]">
            {hours.map((h) => (
              <div key={h.id} className="col-span-2 grid grid-cols-subgrid">
                <dt className="text-body-sm text-ink">{dayName(h.dayOfWeek)}</dt>
                <dd className="text-body-sm text-muted tabular-nums">
                  {hhmm(h.startTime)} – {hhmm(h.endTime)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <p className="text-body-sm text-muted">No opening hours on record yet.</p>
      )}

      {business.phone ? <IconLine icon={Icons.phone}>{business.phone}</IconLine> : null}
    </div>
  );
}
