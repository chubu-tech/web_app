"use client";

import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { results as copy } from "@/lib/content";
import { formatDistance, type Match } from "@/lib/search";
import { cn } from "@/lib/utils";
import { MotifDiamond } from "./ui/bhutan";

/**
 * One real salon.
 *
 * Everything shown is read from the database at build time, so nothing here is
 * invented — which also means fields can be blank. A salon with no cover photo
 * gets the woven motif rather than a stock photograph of somebody else's salon,
 * and a salon with no reviews reads "New" rather than a fabricated rating.
 */
export function SalonCard({ match }: { match: Match }) {
  const { salon, distanceKm } = match;
  const featured = salon.plan === "growth" || salon.plan === "pro";

  return (
    <article
      className={cn(
        "group rounded-slab bg-paper shadow-card relative flex flex-col overflow-hidden",
        "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1",
      )}
    >
      <div className="bg-canvas-deep relative aspect-[4/3] w-full overflow-hidden">
        {salon.coverUrl ? (
          <Image
            src={salon.coverUrl}
            alt={`${salon.name} interior`}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="from-canvas-deep to-sand grid h-full w-full place-items-center bg-gradient-to-br"
            aria-hidden
          >
            <MotifDiamond className="text-maroon/25 size-10" />
          </div>
        )}

        {featured && (
          <span className="bg-paper/90 text-ink absolute top-3 left-3 rounded-full px-2.5 py-1 text-caption-sm font-semibold backdrop-blur-sm">
            {copy.featured}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-body-lg leading-snug font-semibold">
            {salon.name}
          </h3>
          {salon.reviewCount > 0 && salon.rating != null ? (
            <span className="text-ink inline-flex shrink-0 items-center gap-1 text-caption font-medium tabular-nums">
              <Star className="text-star size-3.5 fill-current" aria-hidden />
              {salon.rating.toFixed(1)}
              <span className="text-muted-soft font-normal">
                ({salon.reviewCount})
              </span>
            </span>
          ) : (
            <span className="text-muted-soft shrink-0 text-caption-sm font-medium">
              {copy.noRating}
            </span>
          )}
        </div>

        <p className="text-muted inline-flex items-center gap-1.5 text-caption">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {salon.city ?? "Bhutan"}
          {distanceKm != null && (
            <>
              <span aria-hidden>·</span>
              {formatDistance(distanceKm)}
            </>
          )}
        </p>

        {salon.services.length > 0 && (
          <p className="text-muted-soft mt-1 line-clamp-2 text-caption leading-relaxed">
            {salon.services.slice(0, 4).join(" · ")}
          </p>
        )}

        {/* The store links in content.ts are still empty strings, so the card
            hands off to the download band rather than to a dead URL. */}
        <a
          href="#download"
          className="text-ink mt-auto pt-3 text-body-sm font-medium underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current"
        >
          {copy.cta}
        </a>
      </div>
    </article>
  );
}
