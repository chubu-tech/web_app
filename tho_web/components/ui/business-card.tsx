import Link from "next/link";
import { CardMedia } from "./card-media";
import { Icons, IconSize } from "./icons";
import { RatingPill } from "./rating";
import { cn } from "@/lib/utils";

/**
 * The photo-forward salon card, ported from
 * `tho/app/lib/ui/widgets/business_card.dart` and since taken past it — the Dart
 * card is a 150px cover on a phone, and this is the unit a desktop browse grid is
 * built out of.
 *
 * The whole card is one link, spread by a `::after` overlay on the name rather
 * than by wrapping everything in an `<a>`. That keeps exactly one link in the
 * accessibility tree — named by the salon, not by "cover image, 4.6, Norzin Lam" —
 * and leaves room for the favourite button to sit above it. A button nested inside
 * an anchor is invalid and unreachable by keyboard.
 *
 * `favourite` is a slot, not a callback, so this component stays renderable from a
 * server component with only the heart as a client island.
 *
 * ## Focus is drawn on the card, not on the name
 *
 * A consequence of that `::after` trick, and it was wrong before: an outline follows
 * the element's own boxes and an absolutely-positioned pseudo-element is not one of
 * them, so tabbing to a card drew a 2px box around the *salon's name* — a 14px strip
 * inside a 300px card — while the previous code additionally set `focus-within:ring-0`
 * and cancelled even that. So the link's own outline is suppressed and the card wears
 * the indicator, keyed on `has-[a:focus-visible]` rather than `focus-within` so that
 * reaching the heart rings the heart and not the whole card.
 *
 * It has to be an **outline** rather than a ring: `shadow-card` and `shadow-lift` are
 * `@utility` rules that set `box-shadow` outright instead of composing through
 * Tailwind's shadow variables, so a ring and the resting shadow would fight over one
 * property and the winner would be decided by stylesheet order.
 *
 * ## Hover is a composited move plus a shadow, and keyboard gets the same
 *
 * The lift is `translate` and the cover's zoom is `scale`, both of which the
 * compositor handles without touching layout, so a grid of 13 cards does not reflow
 * when one is pointed at. The shadow crossfade is the one paint, and it is on a single
 * card at a time.
 *
 * **The transitioned property is `translate`, not `transform`.** Tailwind 4 compiles
 * the translate utilities to the individual `translate` property — and `scale` to
 * `scale` — so a transition list naming `transform` matches nothing and the card jumps
 * to its lifted position in one frame. Measured: the computed `transform` on a focused
 * card stayed `none` while it had visibly moved. `transition-transform` would also have
 * worked, since Tailwind expands that one to all four, but naming the two properties
 * that actually change is the point of listing them.
 *
 * Every motion is behind `motion-safe`, because the global reduced-motion block
 * collapses a transition's *duration* but not the movement itself — without the
 * variant, someone who asked for less motion would get the 6px jump with no animation,
 * which is the worse half of the effect rather than none of it.
 */
export function BusinessCard({
  id,
  name,
  subtitle,
  imageUrl,
  avgRating,
  reviewCount,
  distanceLabel,
  favourite,
  sizes = "(min-width: 744px) 420px, 100vw",
  compact = false,
  className,
}: {
  id: string;
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  avgRating: number | null;
  reviewCount: number;
  /**
   * Already formatted, e.g. "0.4 km". The number is `formatKm`'s to round — its
   * behaviour is pinned by the ported tests — and `lib/discover-logic` is customer
   * domain that the shared kit should not be reaching into for one string.
   */
  distanceLabel?: string | null;
  favourite?: React.ReactNode;
  sizes?: string;
  /**
   * Drops the 16:10 frame for a short banner. For the map preview, which is 560px
   * wide inside a floating overlay — at the browse ratio its cover alone would be
   * 350px tall and the card would cover the map it is a preview of.
   */
  compact?: boolean;
  className?: string;
}) {
  // Unchanged from the port: an unrated salon shows no pill rather than "New" over
  // its cover. `RatingPill` can say "New", and the salon page uses it that way.
  const rated = reviewCount > 0;

  return (
    <article
      className={cn(
        "group border-hairline-soft bg-canvas shadow-card relative flex flex-col overflow-hidden rounded-lg",
        "transition-[translate,box-shadow] duration-[var(--duration-slow)] ease-out-expo",
        "hover:shadow-lift has-[a:focus-visible]:shadow-lift",
        "motion-safe:hover:-translate-y-1.5 motion-safe:has-[a:focus-visible]:-translate-y-1.5",
        "has-[a:focus-visible]:outline-ink has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2",
        className,
      )}
    >
      <CardMedia
        label={name}
        imageUrl={imageUrl}
        sizes={sizes}
        className={compact ? "aspect-auto h-[150px]" : undefined}
        chip={
          distanceLabel ? (
            <MediaChip>
              <Icons.location
                className="text-rausch-cta shrink-0"
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              {distanceLabel}
            </MediaChip>
          ) : undefined
        }
        action={favourite}
        badge={
          rated ? (
            <MediaChip>
              <RatingPill rating={avgRating} count={reviewCount} />
            </MediaChip>
          ) : undefined
        }
        // Only where there is a badge to seat. An unrated salon shows no pill, and on
        // one of those the gradient is a grey band across the bottom of the cover doing
        // nothing — most visible on the monogram fallback, whose pale gradient it turns
        // to a smudge. 4 of 13 live salons have no cover and several are unrated, so
        // that is a common card, not a corner.
        scrim={rated}
      />

      <div className="p-base gap-md flex items-center">
        <div className="min-w-0 flex-1">
          <h3 className="text-title text-ink truncate font-semibold">
            <Link
              href={`/salon/${id}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
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
          className="text-muted-soft shrink-0 transition-transform duration-[var(--duration-base)] ease-out-expo motion-safe:group-hover:translate-x-0.5"
          style={{ width: IconSize.xxs, height: IconSize.xxs }}
          aria-hidden
        />
      </div>
    </article>
  );
}

/**
 * The shell both overlay badges wear, at 92% canvas over a blur — the value
 * `FavouriteButton` already sits at on the third corner, so the three read as one
 * family rather than three accidents.
 *
 * ## Why these are not white text on the gradient
 *
 * That is the prettier treatment and it was built first; it fails WCAG AA over a light
 * photograph, which several live covers are. The scrim is `from-black/70` at the very
 * bottom of a 73px band, and the badge sits 12-32px up from that edge, so the alpha
 * actually behind the text is nearer 39%. Over a white cover that leaves a background
 * luminance of ~0.61 and white-on-that is about **1.6:1** — against the 4.5:1 a 12px
 * label needs. Making it pass would have meant a scrim opaque enough (~82%) to stop
 * being a gradient and start being a black bar.
 *
 * Ink on 92% canvas clears it by a wide margin whatever is underneath, because at 92%
 * the photograph contributes 8% of the result. The gradient stays for what it is
 * genuinely good at: grounding the bottom of the photograph against the card body, and
 * giving the badge something to sit on rather than float over.
 *
 * The star keeps `--color-star` — it is legible on both and it is the one colour in
 * this system that means exactly one thing.
 */
function MediaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-canvas/92 text-ink text-badge px-sm py-xxs gap-xxs shadow-card inline-flex items-center rounded-full font-semibold backdrop-blur-sm">
      {children}
    </span>
  );
}
