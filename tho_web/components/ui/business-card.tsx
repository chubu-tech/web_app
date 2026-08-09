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
 * ## The frame came off, and that is the whole redesign
 *
 * This used to be a bordered, shadowed, canvas-filled box with the rating overlaid on the
 * photograph. It is now **an image and three lines of text on the page**, which is the
 * layout Fresha uses and, before it, every marketplace with a photograph worth looking
 * at. Four consequences, each a reason rather than a side effect:
 *
 * - **The photograph is the card.** A border and a shadow draw a second rectangle around
 *   a picture that already has four edges, and on a grid of thirteen the borders read as
 *   a table. Removing them puts every pixel of contrast back into the covers.
 * - **The rating moved off the cover and beside the name.** It was a frosted pill over
 *   the bottom-left of the photo, sitting on a scrim that existed only to hold it —
 *   `MediaChip`'s comment is a paragraph of contrast arithmetic about how to make white
 *   text survive a light cover. On a line of its own, against canvas, none of that is a
 *   problem to solve: the star is gold, the number is ink, and the scrim is gone with it.
 * - **Three lines, in decreasing commitment**: the name, where it is, and what it is —
 *   *"Salon · 12 reviews"*. `meta` is that third line and it is what the review count
 *   moved into, which is why `RatingPill` is asked for `showCount={false}` here.
 * - **The hover lift went too.** A 6px rise plus a shadow crossfade is how a *raised
 *   surface* behaves, and there is no surface any more. The cover's zoom is the hover
 *   now, which is the one that was always about the photograph.
 *
 * `framed` puts all of it back for the one caller that needs a surface: the map preview
 * floats over a map, so a borderless card would have its text on tiles.
 *
 * ## The link, and where focus is drawn
 *
 * The whole card is one link, spread by a `::after` overlay on the name rather than by
 * wrapping everything in an `<a>`. That keeps exactly one link in the accessibility tree
 * — named by the salon, not by "cover image, 4.6, Norzin Lam" — and leaves room for the
 * favourite button to sit above it. A button nested inside an anchor is invalid and
 * unreachable by keyboard.
 *
 * A consequence of that `::after` trick, and it was wrong before: an outline follows the
 * element's own boxes and an absolutely-positioned pseudo-element is not one of them, so
 * tabbing to a card drew a 2px box around the *salon's name* — a 14px strip inside a
 * 300px card. So the link's own outline is suppressed and the card wears the indicator,
 * keyed on `has-[a:focus-visible]` rather than `focus-within` so that reaching the heart
 * rings the heart and not the whole card.
 *
 * With no frame to outline, the indicator is drawn by a positioned span at `-inset-2`
 * rather than by an `outline` on the article — the article's own box now stops at the
 * text baseline, and an outline on it would trace the content instead of the card.
 *
 * `favourite` is a slot, not a callback, so this component stays renderable from a
 * server component with only the heart as a client island.
 */
export function BusinessCard({
  id,
  name,
  subtitle,
  meta,
  imageUrl,
  avgRating,
  reviewCount,
  distanceLabel,
  chip,
  favourite,
  sizes = "(min-width: 744px) 420px, 100vw",
  compact = false,
  framed = false,
  priority = false,
  className,
}: {
  id: string;
  name: string;
  /** Line two — the address. */
  subtitle?: string | null;
  /** Line three — what the place is and how many have rated it. */
  meta?: string | null;
  imageUrl?: string | null;
  avgRating: number | null;
  reviewCount: number;
  /**
   * Already formatted, e.g. "0.4 km". The number is `formatKm`'s to round — its
   * behaviour is pinned by the ported tests — and `lib/discover-logic` is customer
   * domain that the shared kit should not be reaching into for one string.
   *
   * Ignored when `chip` is given: they are the same corner, and a row that has put its
   * own reason there has said something more specific than a distance.
   */
  distanceLabel?: string | null;
  /**
   * Overrides the top-left pill outright — the Discover rows put their rank reason
   * there ("Open now", "4.9"), which is Fresha's "Featured" slot.
   */
  chip?: React.ReactNode;
  favourite?: React.ReactNode;
  sizes?: string;
  /**
   * Drops the 3:2 frame for a short banner. For the map preview, which is 560px
   * wide inside a floating overlay — at the browse ratio its cover alone would be
   * 373px tall and the card would cover the map it is a preview of.
   */
  compact?: boolean;
  /** Restores the bordered, shadowed surface. The map preview, and nothing else. */
  framed?: boolean;
  priority?: boolean;
  className?: string;
}) {
  // Unchanged from the port: an unrated salon shows no rating rather than "New" over
  // its cover. `RatingPill` can say "New", and the salon page uses it that way.
  const rated = reviewCount > 0 && avgRating != null;

  return (
    <article
      className={cn(
        "group relative flex flex-col",
        framed &&
          "border-hairline-soft bg-canvas shadow-card overflow-hidden rounded-lg",
        className,
      )}
    >
      <CardMedia
        label={name}
        imageUrl={imageUrl}
        sizes={sizes}
        priority={priority}
        className={cn(
          // The radius lives on the media now rather than on a frame clipping it. 14px,
          // not the 20px `rounded-lg` the frame had: a corner that big reads as a rounded
          // *tile* on a bare photograph, where inside a border it read as the border's.
          !framed && "rounded-md",
          compact && "aspect-auto h-[150px]",
        )}
        chip={
          chip ??
          (distanceLabel ? (
            <MediaChip>
              <Icons.location
                className="text-rausch-cta shrink-0"
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              {distanceLabel}
            </MediaChip>
          ) : undefined)
        }
        action={favourite}
        // No badge and no scrim. Both existed to carry the rating over the photograph,
        // and the rating is beside the name now. A gradient with nothing on it is a grey
        // band across the bottom of every cover — most visible on the monogram fallback,
        // whose pale gradient it turns to a smudge, and 4 of 13 live salons have one.
      />

      <div className={cn("gap-md flex items-start", framed ? "p-base" : "mt-md")}>
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
            <p className="text-body-sm text-muted mt-xxs truncate">{subtitle}</p>
          ) : null}
          {meta ? (
            <p className="text-body-sm text-muted mt-xxs truncate">{meta}</p>
          ) : null}
        </div>

        {/* Top-aligned with the name, not centred in the block: it belongs to the title
            line, and centring it against a three-line stack floats it beside the address
            instead. `shrink-0` because "4.9" must never wrap under a long salon name. */}
        {rated ? (
          <RatingPill
            rating={avgRating}
            count={reviewCount}
            showCount={false}
            className="mt-px shrink-0"
          />
        ) : null}
      </div>

      {/* The focus indicator. A span rather than an `outline` on the article — see above. */}
      <span
        aria-hidden
        className={cn(
          "outline-ink pointer-events-none absolute rounded-lg outline-0 outline-offset-0 group-has-[a:focus-visible]:outline-2",
          framed ? "inset-0" : "-inset-2",
        )}
      />
    </article>
  );
}

/**
 * The shell the top-left pill wears, at 92% canvas over a blur — the value
 * `FavouriteButton` already sits at on the opposite corner, so the two read as a pair
 * rather than two accidents.
 *
 * ## Why this is not white text on a gradient
 *
 * That is the prettier treatment and it was built first; it fails WCAG AA over a light
 * photograph, which several live covers are. A bottom scrim is `from-black/70` over a
 * 73px band and a pill sits 12-32px up from that edge, so the alpha actually behind the
 * text is nearer 39%. Over a white cover that leaves a background luminance of ~0.61 and
 * white-on-that is about **1.6:1** — against the 4.5:1 a 12px label needs. Making it pass
 * would have meant a scrim opaque enough (~82%) to stop being a gradient and start being
 * a black bar.
 *
 * Ink on 92% canvas clears it by a wide margin whatever is underneath, because at 92% the
 * photograph contributes 8% of the result.
 */
export function MediaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-canvas/92 text-ink text-badge px-sm py-xxs gap-xxs shadow-card inline-flex items-center rounded-full font-semibold backdrop-blur-sm">
      {children}
    </span>
  );
}
