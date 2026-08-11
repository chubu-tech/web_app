import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FavouriteButton } from "@/components/customer/favourite-button";
import { MessageSalonButton } from "@/components/customer/message-salon-button";
import { SalonBooking } from "@/components/customer/salon-booking";
import { LoyaltyCard } from "@/components/customer/loyalty-card";
import { SalonGallery } from "@/components/customer/salon-gallery";
import { SalonSection, SalonSectionNav } from "@/components/customer/salon-section-nav";
import { SalonServices } from "@/components/customer/salon-services";
import { SalonShop } from "@/components/customer/salon-shop";
import { ShareButton } from "@/components/customer/share-button";
import { WalkInCard } from "@/components/customer/walk-in-card";
import {
  ActionCircle,
  HeroCircleButton,
  IconLine,
  SpecialistCard,
} from "@/components/ui/detail-bits";
import { Icons, IconSize } from "@/components/ui/icons";
import { PhotoStrip } from "@/components/ui/photo-gallery";
import { RatingPill, StarBar } from "@/components/ui/rating";
import { ReportButton } from "@/components/ui/report-button";
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
import { jsonLdScript, salonSchema } from "@/lib/seo";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { LoyaltyBalance, LoyaltyReward } from "@/lib/types/back-office";
import type { QueueEntry } from "@/lib/types/queue";
import { hasLocation, offerEndsLabel, runsQueue, travels } from "@/lib/types/salon";
import type { Review } from "@/lib/types/salon";
import { whatsappUrl } from "@/lib/whatsapp";

/**
 * The salon page, ported from `tho/app/lib/customer/business_detail_screen.dart` and
 * since **re-laid-out to the shape a marketplace listing has on the web** — the
 * arrangement Fresha uses, and the one this page's own content was already fighting.
 *
 * ## What changed, and why each piece moved
 *
 * - **A title block above the photographs, not text over them.** The name, the rating,
 *   today's hours and the address were three stacked icon-lines *below* a 360px banner
 *   that carried the back button, share and save floating on top of it. Now they are one
 *   line under an `h1`, above the mosaic, and the actions are buttons in that block
 *   rather than circles over a photograph. Copy over an arbitrary customer-uploaded
 *   image is a contrast problem with no fixed answer; copy on canvas has none.
 * - **Every section is on the page, with a sticky nav to them.** `SalonTabs` showed one
 *   panel at a time — see `salon-section-nav.tsx` for why that is the wrong trade on a
 *   page whose job is to answer "is this salon any good".
 * - **The price list is a reading surface.** Services were *only* radio tiles in the
 *   rail, so the answer to "what does a haircut cost here" was inside a form control. It
 *   is a proper list now, and its Book buttons hand a service to the rail.
 * - **The rail is a summary card.** Name, rating, the booking picker, then hours and the
 *   address — Fresha's right-hand card, with this product's picker where Fresha has a
 *   Book now button, because a booking here needs a stylist too.
 *
 * **Every optional piece is still caught on its own.** The gallery, the category line, the
 * products, the offers — none of them may take the page down, which is what
 * `business_detail_screen.dart:104-144` does with a `try` per fetch. That matters more
 * here than in the app: 12 of 13 live salons have no gallery and 12 have no products, so
 * the missing-data path *is* the normal path.
 *
 * All of it is anon-readable, so the whole page renders for a visitor with no session —
 * which is what a shared link or a QR scan gets.
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

  const description =
    business.description ??
    `Book a chair at ${business.name}${business.addressText ? ` — ${business.addressText}` : ""}.`;
  const path = `/salon/${business.id}`;

  return {
    title: business.name,
    description,
    /*
      **The canonical, and the reason this page needs one more than any other.** It is
      reachable at `/salon/<id>` *and* at `/salon/<id>?service=<id>` — the price list
      hands a service to the rail through that parameter, so every service on the page is
      a link that produces a distinct URL with identical content. Without a canonical
      those are duplicates competing with each other; with it they are one page. Absolute
      via `metadataBase`, which the root layout now sets.
    */
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: business.name,
      description,
      url: path,
      // The salon's own cover, so a link pasted into WhatsApp — which is how this
      // product is shared in Bhutan — unfurls as the shop rather than as a bare URL.
      // `next/image` is not involved: an unfurler fetches this directly.
      ...(business.coverUrl ? { images: [{ url: business.coverUrl }] } : {}),
    },
  };
}

export default async function SalonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ service?: string | string[]; gender?: string | string[] }>;
}) {
  const { id } = await params;
  const { service: serviceParam, gender: genderParam } = await searchParams;
  /*
    Discover's gender filter, in transit. Not validated here beyond taking the first value:
    `BookingServiceStep` falls back to "any" for anything `GENDER_SERVICE_KINDS` does not
    know, which is the one place that decision belongs.
  */
  const gender = (Array.isArray(genderParam) ? genderParam[0] : genderParam) ?? "any";
  const supabase = await createClient();

  /*
    ## Two waves, not four

    This page used to await in four steps — the business, then eleven reads, then
    `{account, queueLine, loyaltyProgram}`, then `{rewards, balance}` — and each step is a
    full round trip to a database that is not local. Measured cold: **DCL 3832 ms, LCP
    4560 ms**, the slowest page in the app and the most-travelled one in the product.

    Only two of those steps are real dependencies. Everything in the first wave keys off
    `id`, which comes from the URL, **not** off the business row — so the `notFound()` gate
    does not have to run before them. And `queueLine` needs `business` (for `runsQueue`)
    while `rewards`/`balance` need `loyaltyProgram` and `account`, which is one genuine
    dependency, not two.

    So: everything that needs only `id` goes in wave one, everything that needs wave one's
    answers goes in wave two. The `notFound()` moves below the first `await` — the reads it
    used to guard are harmless on a salon that does not exist (they return empty and are
    discarded), and paying for them on the rare 404 is a far better trade than making every
    real visitor wait a serial round trip to prove the salon exists.
  */
  const [
    business,
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
    account,
    loyaltyProgram,
  ] = await Promise.all([
    fetchBusinessById(supabase, id),
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
    // Free to hoist into wave one: `cache()` on `getAccount` means the shell layout has
    // very likely already resolved this, so it costs nothing here either way.
    getAccount(),
    // Null for a salon with no programme *or* a switched-off one, since
    // `loyalty_programs_select_public` admits only `is_active` — so the card can be included
    // unconditionally and simply renders nothing. Decorative: loyalty must not take the page down.
    fetchPublicLoyaltyProgram(supabase, id).catch(() => null),
  ]);

  if (!business) notFound();

  /**
   * Wave two — the reads that genuinely could not go above.
   *
   * The walk-in line is read once for the card's badge, and **only** for a salon that
   * actually runs a queue, so 10 of the 13 live salons don't pay for an RPC whose card
   * never renders. That test needs `business`, which is why this is a second wave at all.
   * `queue_active_line` is revoked from `anon`, so this legitimately fails for a signed-out
   * visitor; `null` reaches the badge as "Wait unknown" rather than a fabricated zero.
   */
  const [queueLine, [loyaltyRewards, loyaltyBalance]] = await Promise.all([
    runsQueue(business)
      ? fetchActiveLine(supabase, id).catch(() => null as QueueEntry[] | null)
      : Promise.resolve(null),
    /**
     * The rewards menu and the caller's balance, read only when there is a programme to
     * read them for — the one real dependency on wave one, since `loyaltyProgram` decides
     * whether either read happens at all.
     *
     * The menu is public (`loyalty_rewards_select_public`) and the balance is not —
     * `loyalty_balance` raises `28000` without a session — so a visitor sees what is on
     * offer and no number. That split is the point: the rewards are the advertisement.
     */
    loyaltyProgram
      ? Promise.all([
          fetchPublicRewards(supabase, id).catch(() => []),
          account.state === "registered"
            ? fetchLoyaltyBalance(supabase, id, account.user.id).catch(() => null)
            : Promise.resolve(null),
        ])
      : // Typed rather than `as const`: the tuple's first element flows into a prop typed
        // `LoyaltyReward[]`, and a `readonly []` is not assignable to a mutable array.
        Promise.resolve<[LoyaltyReward[], LoyaltyBalance | null]>([[], null]),
  ]);

  const isTravelling = travels(business);
  const wa = whatsappUrl(
    business.whatsappPhone,
    `Hi ${business.name}, I found you on Tho.`,
  );
  const saved = favouriteIds.has(id);

  /**
   * `?service=` — the price list's handover to the rail, **validated here.**
   *
   * It comes off a URL, so it is checked against this salon's own `service_staff` before
   * it reaches the picker. Without that, a hand-edited id preselects nothing selectable
   * and the stylist list renders "No stylist here performs that service" for a service
   * that is not on the page at all. Same rule `/salon/[id]/book` applies to its pair.
   */
  const requested = Array.isArray(serviceParam) ? serviceParam[0] : serviceParam;
  const initialServiceId =
    requested && (staffByService[requested]?.length ?? 0) > 0 ? requested : null;

  /**
   * The mosaic's photographs: the cover first, then the gallery.
   *
   * De-duplicated because `business_photos` may repeat the cover — the owner uploads it
   * twice through two different forms and nothing upstream stops them — and the same
   * photograph appearing as both the hero and the tile beside it reads as a bug.
   *
   * **Each one is paired back to its `business_photos` id**, which is what
   * `report_content` identifies a `business_photo` by. The cover has none of its own — it
   * is a column on `businesses`, not a row — so it reports as null *unless* it is also a
   * gallery row, which the duplicate case above is exactly when it is. Resolving it here
   * rather than in the component is deliberate: the de-duplication happens here, so this is
   * the only place that still knows which url came from which row.
   */
  const photoIdByUrl = new Map(photos.map((p) => [p.url, p.id]));
  const galleryPhotos = [...new Set([business.coverUrl, ...photos.map((p) => p.url)])]
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .map((url) => ({ url, reportId: photoIdByUrl.get(url) ?? null }));

  /**
   * The nav's sections, in document order, **built from what actually exists.**
   *
   * The same rule `destinations.ts` follows for the top nav: an entry appears only when
   * its target does. A "Shop" link that scrolled to nothing on 12 of 13 salons would be
   * the dead end the tab version was careful to avoid.
   */
  const sections = [
    { id: "services", label: "Services" },
    ...(products.length > 0 ? [{ id: "shop", label: "Shop" }] : []),
    ...(staff.length > 0 ? [{ id: "team", label: "Team" }] : []),
    ...(reviews.length > 0 ? [{ id: "reviews", label: "Reviews" }] : []),
    { id: "about", label: "About" },
  ];

  const directionsHref = hasLocation(business)
    ? `https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`
    : null;

  return (
    <div>
      {/*
        The structured data — a `HairSalon` with its address, coordinates, opening hours
        and rating. This is what puts a salon in a map pack and gives it stars in a
        result; the same page without it is a title and 155 characters of description.

        Rendered from the data already fetched above, so it costs no extra read, and built
        by `lib/seo.ts` rather than inline because "what we claim about this salon" is the
        sort of thing that gets tests — including the three Google-policy rules a hand-
        written object gets wrong (no rating without reviews, no address for a
        home-based stylist, Sunday is day 0).

        `jsonLdScript` escapes `<`, which is what makes `dangerouslySetInnerHTML` safe
        here: the name and description are typed by the salon's own owner.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(salonSchema({ business, hours, services })),
        }}
      />

      {/*
        The title block and the mosaic, in one 1280px column.

        1280 rather than the 1440 this page used: at 1440 the two-column body ran to 1360px
        of text and the rail sat 380px from the right edge of a 1920 display, which is wider
        than any listing page wants to be. Discover is deliberately full-bleed — that was the
        fix for the blank band — and this is deliberately a column, because it is a document
        about one salon rather than a grid of many.
      */}
      <div className="px-base pt-lg tablet:px-lg mx-auto w-full max-w-[1280px]">
        <div className="gap-base flex items-start">
          {/* The back affordance stays, and stays first — arriving from Discover, a QR
              scan or a shared link, this is the only way back into the product. It was
              floating over the cover photograph; here it is in the flow. */}
          <HeroCircleButton icon={Icons.back} label="Back to Discover" href="/" />

          <div className="min-w-0 flex-1">
            <h1 className="text-display-xl text-ink font-semibold tracking-tight">
              {business.name}
            </h1>

            {/*
              One line, in Fresha's order: how good · when it shuts · where it is.

              It replaced three stacked `IconLine`s. The icons went with them: at the top of
              a page where each fact is one phrase, a clock and a pin beside them are three
              glyphs doing the work a middot already does. `IconLine` is still right inside
              About, where the same facts sit among prose.
            */}
            {/* One inline row from 744 up, a stack below it.

                Not just `flex-wrap`: at 390 these four facts wrap onto four lines and the
                middots between them end up stranded at the ends and starts of lines,
                separating nothing. A separator only works while its two sides are on the
                same line, so below 744 the dots are hidden and the line breaks do the
                separating instead. */}
            <div className="text-body-sm text-muted mt-xs gap-y-xxs tablet:gap-x-sm flex flex-col items-start tablet:flex-row tablet:flex-wrap tablet:items-center">
              {business.reviewCount > 0 && business.avgRating != null ? (
                <>
                  <span className="gap-xs flex items-center">
                    <StarBar rating={business.avgRating} size={16} />
                    <span className="text-ink font-semibold tabular-nums">
                      {business.avgRating.toFixed(1)}
                    </span>
                    <a href="#reviews" className="hover:text-ink underline">
                      ({business.reviewCount})
                    </a>
                  </span>
                  <Dot />
                </>
              ) : null}

              {/* `todayHoursLine` already says "Open until 21:00" or "Closed today", so
                  the copy is not restated here — it is the one string both this line and
                  About read, which is what stops them disagreeing. */}
              <span>{todayHoursLine(hours)}</span>

              {isTravelling ? (
                <>
                  <Dot />
                  <span>{coverageLine(business)}</span>
                </>
              ) : business.addressText ? (
                <>
                  <Dot />
                  <span>{business.addressText}</span>
                </>
              ) : null}

              {!isTravelling && directionsHref ? (
                <>
                  <Dot />
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rausch-cta font-medium hover:underline"
                  >
                    Get directions
                  </a>
                </>
              ) : null}
            </div>
          </div>

          {/* Share and save, as circles on canvas rather than over a photograph. Same two
              components, same `hero` treatment — only what is behind them changed. */}
          <div className="gap-sm flex shrink-0 items-center">
            <ShareButton name={business.name} variant="hero" />
            <FavouriteButton
              businessId={id}
              name={business.name}
              initial={saved}
              variant="hero"
            />
          </div>
        </div>

        <div className="mt-base">
          <SalonGallery name={business.name} photos={galleryPhotos} />
        </div>
      </div>

      {/* Sticky, and outside the column so its bottom hairline runs the full width — which
          is what makes it read as chrome rather than as a rule inside the content. */}
      <div className="mt-lg">
        <SalonSectionNav sections={sections} />
      </div>

      {/*
        The body. Two columns from 1128, one below it, and the rail's position is the one
        thing that differs from the old layout's grid: it was row 2 on a phone, *above* the
        reading, because the picker was the only place a price appeared. The price list is a
        real section now, so the rail can follow the content on a phone the way it follows
        the page on a desktop — and the fixed CTA bar inside `SalonBooking` keeps the action
        one tap away at every scroll position regardless.
      */}
      <div className="px-base py-lg gap-xl tablet:px-lg mx-auto grid w-full max-w-[1280px] grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_360px]">
        <div className="gap-xxl flex min-w-0 flex-col desktop:col-start-1">
          {/* Contact and walk-in first: both are about reaching the salon *today*, which
              is a different question from the price list underneath. */}
          <div>
            <div className="gap-base flex overflow-x-auto pb-1">
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
              {!isTravelling && directionsHref ? (
                <ActionCircle
                  icon={Icons.nearMe}
                  label="Directions"
                  href={directionsHref}
                  external
                />
              ) : null}
            </div>

            {/* If the shop takes walk-ins and you are standing outside it, that is the
                faster of the two paths — `business_detail_screen.dart:343` puts it here
                for the same reason. */}
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
          </div>

          <SalonSection id="services">
            <SectionHeader title="Services" as="h2" className="mb-base" />
            <SalonServices
              salonId={id}
              services={services}
              staffByService={staffByService}
              selectedId={initialServiceId}
            />
          </SalonSection>

          {products.length > 0 ? (
            <SalonSection id="shop">
              <SectionHeader title="Shop" as="h2" className="mb-base" />
              <SalonShop products={products} salonName={business.name} />
            </SalonSection>
          ) : null}

          {staff.length > 0 ? (
            <SalonSection id="team">
              <SectionHeader title="Team" as="h2" className="mb-base" />
              <Specialists staff={staff} />
            </SalonSection>
          ) : null}

          {reviews.length > 0 ? (
            <SalonSection id="reviews">
              <SectionHeader title="Reviews" as="h2" className="mb-base" />
              <Reviews
                reviews={reviews}
                avgRating={business.avgRating}
                reviewCount={business.reviewCount}
              />
            </SalonSection>
          ) : null}

          <SalonSection id="about">
            <SectionHeader title="About" as="h2" className="mb-base" />
            <About business={business} hours={hours} productCount={products.length} />
          </SalonSection>

          {/* Points are a fact about your relationship with this salon, not a category of
              its content — which is why this was never inside a tab and is not a section
              now either. Renders nothing without an active programme. */}
          <LoyaltyCard
            businessId={id}
            program={loyaltyProgram}
            rewards={loyaltyRewards}
            balance={loyaltyBalance}
            signedIn={account.state === "registered"}
            isGuest={account.state === "guest"}
          />
        </div>

        {/*
          The rail — Fresha's right-hand card.

          `id="book"` is what the price list's Book buttons scroll to, and `scroll-mt` is
          the same offset the sections use: without it an anchor jump parks the card's top
          edge underneath the fixed header and the sticky nav.

          `key` on the picker is what makes `?service=` take effect. `initialServiceId` is
          an initial `useState` value, so React keeps the *first* one for the life of the
          mount and a second press on a different service would change the URL and nothing
          else. Re-keying remounts it, which is the honest way to say "this is a new
          selection" — and it deliberately clears the stylist too, because a stylist chosen
          for the previous service may not perform this one.

          The bottom padding clears `SalonBooking`'s own fixed CTA bar below 1128, so the
          last stylist is never hidden behind it.
        */}
        <aside
          id="book"
          style={{ scrollMarginTop: "calc(var(--header-height) + 3.25rem)" }}
          className="border-hairline-soft bg-paper p-base row-start-2 rounded-md border pb-[calc(var(--cta-clearance)+env(safe-area-inset-bottom))] desktop:col-start-2 desktop:row-start-1 desktop:sticky desktop:top-[calc(var(--header-height)+var(--spacing-base))] desktop:self-start desktop:pb-base"
        >
          {/* The card's head, matching the reference: whose card this is, and how good
              they are. It repeats the `h1` on purpose — on a desktop the rail is sticky
              and travels past the title, so without it the picker eventually floats
              beside a page whose subject has scrolled away. */}
          <div className="border-hairline-soft pb-base mb-base border-b">
            <p className="text-display-sm text-ink font-semibold">{business.name}</p>
            {business.reviewCount > 0 ? (
              <span className="mt-xxs inline-flex">
                <RatingPill rating={business.avgRating} count={business.reviewCount} />
              </span>
            ) : null}
            {categoryNames.length > 0 ? (
              <ul className="gap-xs mt-sm flex flex-wrap">
                {categoryNames.map((c) => (
                  <li
                    key={c}
                    className="bg-rausch/10 text-rausch-cta text-badge px-sm py-xxs rounded-full font-semibold"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <SalonBooking
            gender={gender}
            key={initialServiceId ?? "none"}
            salonId={id}
            services={services}
            staffByService={staffByService}
            initialServiceId={initialServiceId}
          />

          {/* Hours and the address at the foot, under a rule — the reference's card ends
              the same way, and they are the two facts a customer checks *after* deciding
              to come rather than while choosing. */}
          <div className="border-hairline-soft mt-base pt-base gap-xs flex flex-col border-t">
            <IconLine icon={Icons.clock}>{todayHoursLine(hours)}</IconLine>
            {isTravelling ? (
              <IconLine icon={Icons.nearMe}>{coverageLine(business)}</IconLine>
            ) : business.addressText ? (
              <IconLine icon={Icons.location}>{business.addressText}</IconLine>
            ) : null}
            {!isTravelling && directionsHref ? (
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-caption text-rausch-cta font-medium hover:underline"
              >
                Get directions
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * The separator in the header's meta line.
 *
 * `aria-hidden` — it is punctuation, not a word, and a screen reader announcing "middot"
 * four times through one line of facts is noise.
 *
 * Absent below 744, where the meta line is a stack: see the note at the call site.
 */
function Dot() {
  return (
    <span aria-hidden className="text-muted-soft hidden tablet:inline">
      ·
    </span>
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

function Reviews({
  reviews,
  avgRating,
  reviewCount,
}: {
  reviews: Review[];
  avgRating: number | null;
  reviewCount: number;
}) {
  if (reviews.length === 0) {
    return <p className="text-body-sm text-muted">No reviews yet.</p>;
  }
  return (
    <>
      {/*
        The salon's score above its reviews, at reading size — the reference opens the
        section this way and it answers the question before the anecdotes do.

        **`business.avgRating` and `reviewCount`, not an average of the rows below.**
        `fetchReviews` returns a page of the newest, so averaging what is rendered would
        report a different number here from the one in the header and on the browse card,
        and it would move as more reviews arrived. The summary view is the authority.
      */}
      {avgRating != null ? (
        <div className="gap-md mb-base flex items-center">
          <StarBar rating={avgRating} size={22} />
          <p className="text-title text-ink font-semibold tabular-nums">
            {avgRating.toFixed(1)}
            <span className="text-muted ml-1 font-normal">({reviewCount})</span>
          </p>
        </div>
      ) : null}

      <ul className="gap-sm flex flex-col">
      {reviews.map((r) => (
        <li key={r.id} className="border-hairline p-base rounded-md border">
          <div className="gap-md flex items-center justify-between">
            <StarBar rating={r.rating} size={20} />
            <div className="gap-xs flex shrink-0 items-center">
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
              {/* Beside the date, which is where the app puts it
                  (`business_detail_screen.dart:751`) and the only trailing space on the
                  tile that is not the review's own words. */}
              <ReportButton target="review" targetId={r.id} label="this review" />
            </div>
          </div>
          {r.body ? <p className="text-body-sm text-body mt-xs">{r.body}</p> : null}
          {r.photos.length > 0 ? (
            <div className="mt-sm">
              {/*
                A photo reports as itself, and falls back to the review that carries it when
                the row has no id — which cannot happen through `fetchReviews`, since its
                select asks for one, but is the honest answer for any other projection and is
                what the app does at `business_detail_screen.dart:777-786`.
              */}
              <PhotoStrip
                urls={r.photos.map((p) => p.url)}
                size={72}
                reportTargets={r.photos.map((p) =>
                  p.id
                    ? { target: "review_photo" as const, targetId: p.id, label: "this photo" }
                    : { target: "review" as const, targetId: r.id, label: "this review" },
                )}
              />
            </div>
          ) : null}
        </li>
      ))}
      </ul>
    </>
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
