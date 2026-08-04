import { notFound } from "next/navigation";
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
import { SalonTabs } from "@/components/customer/salon-tabs";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchReviewsForStaff } from "@/lib/api/salon";
import {
  fetchStaffById,
  fetchStaffFollowerCount,
  fetchStaffPhotos,
  isFollowingStaff,
} from "@/lib/api/staff";
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

async function load(id: string) {
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
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id).catch(() => null);
  if (!data) return { title: "Stylist" };
  return {
    title: data.staff.displayName,
    description: `${data.staff.displayName} at ${data.business.name}. See reviews and book a chair.`,
  };
}

export default async function StylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();

  const { staff, business, reviews, photos, followers, following } = data;

  const tabs = [
    { label: "Reviews", content: <Reviews reviews={reviews} salonName={business.name} /> },
    { label: "Photos", content: <Photos urls={photos} name={staff.displayName} /> },
  ];

  return (
    <div>
      {/* The salon's cover behind the stylist's own avatar — a specialist has no cover
          of their own in the schema, and the app borrows the salon's the same way. */}
      <div className="relative">
        <CoverImage
          label={business.name}
          imageUrl={business.coverUrl}
          sizes="100vw"
          priority
          className="h-[180px] w-full tablet:h-[240px]"
        />
        <div className="px-base pt-base gap-sm absolute inset-x-0 top-0 flex tablet:px-lg">
          <HeroCircleButton
            icon={Icons.back}
            label={`Back to ${business.name}`}
            href={`/salon/${business.id}?tab=Specialists`}
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
            <a href={`/salon/${business.id}`} className="text-rausch-cta font-medium">
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
            <time
              dateTime={r.createdAt.toISOString()}
              className="text-caption-sm text-muted shrink-0"
            >
              {r.createdAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
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
