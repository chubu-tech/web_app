import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { FollowButton } from "@/components/customer/follow-button";
import { ShareButton } from "@/components/customer/share-button";
import { Avatar } from "@/components/ui/avatar";
import { CoverImage } from "@/components/ui/cover-image";
import { HeroCircleButton, IconLine } from "@/components/ui/detail-bits";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { PhotoCollage } from "@/components/ui/photo-gallery";
import { StarBar } from "@/components/ui/rating";
import { ReportButton } from "@/components/ui/report-button";
import { SalonTabs } from "@/components/customer/salon-tabs";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchReviewsForStaff, fetchServices, fetchServiceStaff } from "@/lib/api/salon";
import {
  fetchStaffById,
  fetchStaffFollowerCount,
  fetchStaffPhotos,
  isFollowingStaff,
} from "@/lib/api/staff";
import { placeOf } from "@/lib/places";
import { breadcrumbSchema, jsonLdScript, stylistSchema } from "@/lib/seo";
import { isCanonicalParam, parseEntityId, salonPath, stylistPath } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/types/salon";

/**
 * A specialist's public profile, ported from
 * `tho/app/lib/customer/staff_profile_screen.dart`: the salon's cover behind the
 * stylist's avatar, follower and review counts, a Follow button, and Reviews / Photos.
 *
 * Anon-readable throughout, so a shared link works with no session.
 *
 * **The page 404s unless the salon itself is visible, and that is a gap being closed
 * rather than a formality.** `staff_select` lets `anon` read any active staff member of
 * an `is_active` business — it does **not** require `status = 'approved'`, which
 * `businesses_select` does. So `Karma Lhendup` of the *pending* `Highland Barbers` is
 * publicly readable while `/salon/<their salon>` correctly 404s. This page renders the
 * salon's cover, name and address, so it has to refuse whatever the salon page
 * refuses: read the staff row, then the business, and 404 when the business comes back
 * null. That one live row is the test case.
 */

/**
 * **`cache`d because `generateMetadata` and the page both call it, in the same request.**
 *
 * Next runs the two in one pass, so an unmemoised loader here is not a tidiness problem —
 * it is this route's six reads run **twice**: the staff row, the business row, and the
 * four in the `Promise.all`. Wrapping it is the same correction `getAccount` and
 * `createClient` already carry, for the same reason and with the same measured cost
 * behind it — see *Per-request reads must be memoised* in `AGENTS.md`.
 *
 * The `.catch(() => null)` stays at the **metadata** call site rather than moving in here.
 * A failed read must still take the page to its error boundary; what it must not do is
 * take it down from inside `generateMetadata`, where the only honest fallback is a
 * generic title.
 */
const load = cache(async (id: string) => {
  const supabase = await createClient();

  const staff = await fetchStaffById(supabase, id);
  if (!staff || !staff.isActive || !staff.businessId) return null;

  const business = await fetchBusinessById(supabase, staff.businessId);
  if (!business) return null;

  const [reviews, photos, followers, following] = await Promise.all([
    fetchReviewsForStaff(supabase, id).catch(() => [] as Review[]),
    fetchStaffPhotos(supabase, id).catch(() => [] as string[]),
    fetchStaffFollowerCount(supabase, id).catch(() => 0),
    // False for a visitor with no session: `follows_select` is authenticated-only.
    isFollowingStaff(supabase, id).catch(() => false),
  ]);

  return { staff, business, reviews, photos, followers, following };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: param } = await params;
  const parsed = parseEntityId(param);
  if (!parsed) return { title: "Stylist" };

  const data = await load(parsed).catch(() => null);
  if (!data) return { title: "Stylist" };

  const { town } = placeOf(data.business);
  /*
    The role and the town, not just the name.

    "Sonam Dorji" is a query nobody types. "hair stylist in Thimphu" is, and so is "who
    does beard trims at Norzin" — so the title states the job and the place, and the
    description says what a reader can do next rather than restating the title. `role` is
    absent on some rows, so it is folded in only when it exists.
  */
  /*
    **`staff_members.role` is a permission, not a job title, and it must not be used as
    one.** Measured on the live database: the only two values across 21 active rows are
    `staff` (18) and `owner` (3) — it is what `is_business_member` keys off, not what the
    person does. Rendering it produced *"Sonam Dorji — staff in Thimphu"* as a page title,
    which is both meaningless to a reader and a wasted title on an indexable page.

    "Stylist" is the product's own word for this person everywhere a customer meets them —
    `SpecialistCard`, "Select professional", the Team section — so it is accurate rather
    than invented. An owner who also takes bookings is still the person in the chair, so
    they get the same word.
  */
  const role = "stylist";
  const title = town
    ? `${data.staff.displayName} — Hair Stylist in ${town.name}, Bhutan`
    : `${data.staff.displayName} — Hair Stylist`;
  const description = `Book ${data.staff.displayName}, ${role} at ${data.business.name}${
    town ? ` in ${town.name}, Bhutan` : ""
  }. See their reviews and work, and book a chair online.`;
  const path = stylistPath(data.staff);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
      title,
      description,
      url: path,
      // The stylist's own photo where there is one, else the salon's cover — a share
      // card with no image is a share card nobody clicks. `staff_photos` has 2 rows
      // platform-wide, so the fallback is the normal path.
      ...(data.staff.photoUrl || data.business.coverUrl
        ? { images: [{ url: (data.staff.photoUrl ?? data.business.coverUrl)! }] }
        : {}),
    },
  };
}

export default async function StylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  // Same scheme as `/salon/[id]`: the id is read off either shape, so an already-shared
  // bare-id link keeps resolving. See `lib/slug.ts`.
  const id = parseEntityId(param);
  if (!id) notFound();

  const data = await load(id);
  if (!data) notFound();

  const { staff, business, reviews, photos, followers, following } = data;

  const canonical = stylistPath(staff);
  if (!isCanonicalParam(param, canonical)) permanentRedirect(canonical);

  /*
    What this stylist actually performs, for `makesOffer`.

    `service_staff` is the authority — and here that is the correct table, unlike on the
    salon page, because the claim being made is *this person does this service* rather
    than *this is on the menu*. It is also what `compute_availability` requires, so every
    service listed is genuinely bookable with them.

    Caught, not bare: this is decorative markup and a failed read must not take a
    stylist's page down.
  */
  const supabase = await createClient();
  const [allServices, staffByService] = await Promise.all([
    fetchServices(supabase, business.id).catch(() => []),
    fetchServiceStaff(supabase, business.id).catch(() => ({}) as Record<string, string[]>),
  ]);
  const performs = allServices.filter((service) =>
    staffByService[service.id]?.includes(staff.id),
  );

  const { town: staffTown } = placeOf(business);
  const trail = [
    { name: "Salons", path: "/salons" },
    ...(staffTown ? [{ name: staffTown.name, path: `/salons/${staffTown.slug}` }] : []),
    { name: business.name, path: salonPath(business) },
    { name: staff.displayName, path: canonical },
  ];

  const tabs = [
    { label: "Reviews", content: <Reviews reviews={reviews} salonName={business.name} /> },
    { label: "Photos", content: <Photos urls={photos} name={staff.displayName} /> },
  ];

  return (
    <div>
      {/* A `Person` whose `worksFor` carries the salon's own `@id`, so a crawler reading
          both pages joins them into one graph instead of two unrelated entities that
          share a name. That link is the whole reason this is worth emitting. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(stylistSchema({ staff, business, services: performs })),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema(trail)) }}
      />

      {/* The salon's cover behind the stylist's own avatar — a specialist has no cover
          of their own in the schema, and the app borrows the salon's the same way. */}
      <div className="relative">
        <CoverImage
          label={business.name}
          imageUrl={business.coverUrl}
          sizes="100vw"
          priority
          // The salon's cover stands in for the stylist's own — say whose shop it is
          // rather than leaving the hero of an indexable page with no alt at all.
          alt={`${business.name}, where ${staff.displayName} works`}
          className="h-[180px] w-full tablet:h-[240px]"
        />
        <div className="px-base pt-base gap-sm absolute inset-x-0 top-0 flex tablet:px-lg">
          <HeroCircleButton
            icon={Icons.back}
            label={`Back to ${business.name}`}
            href={`${salonPath(business)}#team`}
          />
          <span className="flex-1" />
          <ShareButton name={staff.displayName} variant="hero" />
        </div>
      </div>

      <div className="px-base pb-lg mx-auto w-full max-w-[840px] tablet:px-lg">
        <div className="-mt-11 flex flex-col items-center">
          <span className="bg-canvas rounded-full p-[3px]">
            <Avatar name={staff.displayName} photoUrl={staff.photoUrl} size={88} />
          </span>

          <h1 className="text-display-sm text-ink mt-md font-medium">
            {staff.displayName}
          </h1>
          {staff.role ? (
            <p className="text-body-sm text-muted mt-xxs capitalize">{staff.role}</p>
          ) : null}

          {/* Where they work, and a way through to it. The app shows the salon's
              address as plain text; a link is the thing a browser can offer that a
              phone screen with a back button does not need. */}
          <p className="text-body-sm mt-xs">
            <a href={salonPath(business)} className="text-rausch-cta font-medium">
              {business.name}
            </a>
          </p>
          {business.addressText ? (
            <div className="mt-xxs">
              <IconLine icon={Icons.location}>{business.addressText}</IconLine>
            </div>
          ) : null}

          <div className="mt-lg">
            <FollowButton
              staffId={staff.id}
              name={staff.displayName}
              initialFollowing={following}
              initialFollowers={followers}
              reviewCount={reviews.length}
            />
          </div>
        </div>

        <div className="mt-xl">
          <SalonTabs tabs={tabs} />
        </div>
      </div>
    </div>
  );
}

/**
 * Reviews of this stylist's own work — `reviews.staff_member_id`, which every one of
 * the 21 live reviews carries.
 *
 * **No reviewer name, exactly as the app.** Not an omission: `profiles_select` returns
 * another customer's row only to a business member of a salon they have booked with, so
 * a name is not available to ask for. The salon's name leads the row instead, which is
 * what `staff_profile_screen.dart:229` shows.
 */
function Reviews({ reviews, salonName }: { reviews: Review[]; salonName: string }) {
  if (reviews.length === 0) {
    return <EmptyState icon={Icons.star} title="No reviews yet" />;
  }
  return (
    <ul className="gap-sm flex flex-col">
      {reviews.map((r) => (
        <li key={r.id} className="border-hairline p-base rounded-md border">
          <div className="gap-md flex items-baseline justify-between">
            <p className="text-title text-ink truncate font-medium">{salonName}</p>
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
              {/* The same review rows as the salon page's Reviews section — the same
                  `reviews` table, read by `staff_member_id` instead of `business_id` — so
                  they get the same report control. A reportable review that is only
                  reportable on one of the two pages that show it is a gap by accident. */}
              <ReportButton target="review" targetId={r.id} label="this review" />
            </div>
          </div>
          {r.body ? <p className="text-body-sm text-muted mt-xs">{r.body}</p> : null}
          <div className="mt-xs">
            <StarBar rating={r.rating} size={18} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The portfolio. **`staff_photos` has 2 rows platform-wide**, so an empty gallery is
 * the ordinary case, and there is no upload here — `staff_photos_insert` is owner-only,
 * which makes it Phase 3 work.
 */
function Photos({ urls, name }: { urls: string[]; name: string }) {
  if (urls.length === 0) {
    return <EmptyState icon={Icons.imageMissing} title="No photos yet" />;
  }
  return <PhotoCollage urls={urls} title={`${name}'s work`} />;
}
