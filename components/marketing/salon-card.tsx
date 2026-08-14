"use client";

import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { results as copy } from "@/lib/marketing/content";
import { formatDistance, type Match } from "@/lib/marketing/search";
import { cn } from "@/lib/marketing/utils";
import { MotifDiamond } from "./ui/bhutan";

/**
 * One real salon.
 *
 * Everything shown is read from the database at build time, so nothing here is
 * invented — which also means fields can be blank. A salon with no cover photo gets
 * the woven motif rather than a stock photograph of somebody else's salon, and a
 * salon with no reviews reads "New" rather than a fabricated rating.
 *
 * ## It has no card surface, and that is the point
 *
 * The reference's `property-card` is **photo-first and surface-less**: a rounded
 * photo plate with the meta stacked on the page canvas beneath it — no border, no
 * fill, no resting shadow. This one used to be a white slab with a 2rem radius and
 * the shadow tier at rest, which meant a grid of twelve salons was twelve boxes
 * competing with twelve photographs, and the photographs lost.
 *
 * Losing the box also fixes a real layout problem: the meta block is no longer
 * pinned to a shared card height, so a salon with two lines of services and one with
 * none no longer stretch each other.
 *
 * The star stays gold. That is one place THO deliberately departs from the
 * reference, which renders ratings in ink — `--color-star` is the product's single
 * rating colour on every surface in the app, and a rating that changes colour
 * between the website and the app is a rating that reads as a different thing.
 */
export function SalonCard({ match }: { match: Match }) {
  const { salon, distanceKm } = match;
  const featured = salon.plan === "growth" || salon.plan === "pro";

  return (
    <article className="group flex flex-col">
      <div className="bg-surface-soft relative aspect-[4/3] w-full overflow-hidden rounded-md">
        {salon.coverUrl ? (
          <Image
            src={salon.coverUrl}
            alt={`${salon.name} interior`}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="from-surface-soft to-surface-strong grid h-full w-full place-items-center bg-gradient-to-br"
            aria-hidden
          >
            <MotifDiamond className="text-muted-soft/50 size-9" />
          </div>
        )}

        {featured && (
          /* The reference's `guest-favorite-badge`: a white pill at 11px/600
             wearing the one shadow tier, floated top-left over the photo. */
          <span className="bg-canvas text-ink shadow-card absolute top-3 left-3 rounded-full px-2.5 py-1 text-badge font-semibold">
            {copy.featured}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-ink text-subheading min-w-0 truncate font-semibold">
            {salon.name}
          </h3>
          {salon.reviewCount > 0 && salon.rating != null ? (
            <span className="text-ink inline-flex shrink-0 items-center gap-1 text-body-sm font-medium tabular-nums">
              <Star className="text-star size-3.5 fill-current" aria-hidden />
              {salon.rating.toFixed(1)}
              <span className="text-muted-soft font-normal">
                ({salon.reviewCount})
              </span>
            </span>
          ) : (
            <span className="text-muted-soft shrink-0 text-body-sm font-medium">
              {copy.noRating}
            </span>
          )}
        </div>

        <p className="text-muted inline-flex items-center gap-1.5 text-body-sm">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {salon.city ?? "Bhutan"}
            {distanceKm != null && ` · ${formatDistance(distanceKm)}`}
          </span>
        </p>

        {salon.services.length > 0 && (
          <p className="text-muted-soft line-clamp-1 text-body-sm">
            {salon.services.slice(0, 4).join(" · ")}
          </p>
        )}

        {/* The store links in content.ts are still empty strings, so the card
            hands off to the download band rather than to a dead URL. */}
        <a
          href="#download"
          className={cn(
            "text-ink mt-1.5 self-start text-body-sm font-medium",
            "underline decoration-hairline decoration-2 underline-offset-4 transition-colors",
            "group-hover:decoration-ink",
          )}
        >
          {copy.cta}
        </a>
      </div>
    </article>
  );
}
