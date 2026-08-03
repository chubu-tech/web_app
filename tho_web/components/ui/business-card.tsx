import Link from "next/link";
import { CoverImage } from "./cover-image";
import { Icons, IconSize } from "./icons";
import { RatingPill } from "./rating";
import { cn } from "@/lib/utils";

/**
 * The photo-forward salon card, ported from
 * `tho/app/lib/ui/widgets/business_card.dart`.
 *
 * The whole card is one link, spread by a `::after` overlay on the name rather
 * than by wrapping everything in an `<a>`. That keeps exactly one link in the
 * accessibility tree — named by the salon, not by "cover image, 4.6, Norzin Lam" —
 * and leaves room for the favourite button to sit above it. A button nested inside
 * an anchor is invalid and unreachable by keyboard.
 *
 * `favourite` is a slot, not a callback, so this component stays renderable from a
 * server component with only the heart as a client island.
 */
export function BusinessCard({
  id,
  name,
  subtitle,
  imageUrl,
  avgRating,
  reviewCount,
  favourite,
  sizes = "(min-width: 1440px) 25vw, (min-width: 1128px) 33vw, (min-width: 744px) 50vw, 100vw",
  className,
}: {
  id: string;
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  avgRating: number | null;
  reviewCount: number;
  favourite?: React.ReactNode;
  sizes?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "border-hairline-soft bg-canvas shadow-card relative flex flex-col overflow-hidden rounded-md",
        "transition-transform duration-[--duration-fast] focus-within:ring-0 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="relative">
        <CoverImage
          label={name}
          imageUrl={imageUrl}
          sizes={sizes}
          className="h-[150px] w-full rounded-md"
        />
        {reviewCount > 0 ? (
          <span className="bg-canvas shadow-card left-sm bottom-sm px-sm py-xxs absolute rounded-full">
            <RatingPill rating={avgRating} count={reviewCount} />
          </span>
        ) : null}
        {favourite ? (
          <span className="top-sm right-sm absolute z-10">{favourite}</span>
        ) : null}
      </div>

      <div className="p-base gap-md flex items-center">
        <div className="min-w-0 flex-1">
          <h3 className="text-title text-ink truncate font-semibold">
            <Link
              href={`/salon/${id}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {name}
            </Link>
          </h3>
          {subtitle ? (
            <p className="text-body-sm text-muted mt-xxs gap-xs flex items-center">
              <Icons.location
                className="shrink-0"
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              <span className="truncate">{subtitle}</span>
            </p>
          ) : null}
        </div>
        <Icons.chevronRight
          className="text-muted-soft shrink-0"
          style={{ width: IconSize.xxs, height: IconSize.xxs }}
          aria-hidden
        />
      </div>
    </article>
  );
}
