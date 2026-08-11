import { Icons } from "./icons";
import { cn } from "@/lib/utils";

/**
 * The two rating displays, ported from `tho/app/lib/ui/widgets/rating_stars.dart`.
 *
 * Two components rather than one, and the reason is in the Dart: at card scale five
 * 12px glyphs read as *texture*, not as a score — the number is what a reader
 * actually compares between salons. So cards get [RatingPill] (one gold star plus
 * the average), and [StarBar] is for the places with room to show five: a review
 * row, the filter sheet's rating tiers.
 *
 * Stars are **always** `--color-star`. It is the one warm accent in a
 * coral-and-ink system and it means exactly one thing, so it never appears
 * anywhere else.
 */

/** Rounds to the nearest half, so 4.24 → 4.0 and 4.25 → 4.5. A 4.5 reads as four
 *  and a half rather than rounding to either side and misreporting the salon. */
export function roundToHalf(v: number): number {
  return Math.round(Math.min(5, Math.max(0, v)) * 2) / 2;
}

export type StarBarProps = {
  /** 0–5. Rendered to the nearest half star. */
  rating: number;
  size?: number;
  /** On a photo or coloured backdrop the empty stars need to be white-ish rather
   *  than hairline grey, or they vanish entirely. */
  onDark?: boolean;
  className?: string;
};

export function StarBar({
  rating,
  size = 18,
  onDark = false,
  className,
}: StarBarProps) {
  const value = roundToHalf(rating);
  const Star = Icons.star;
  const empty = onDark ? "text-on-primary/45" : "text-hairline";

  return (
    // One label for the row, not five unnamed glyphs: a screen reader wants the
    // score, and the individual stars are texture.
    <span
      className={cn("inline-flex items-center gap-px", className)}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((position) => {
        const full = value >= position;
        const half = !full && value >= position - 0.5;
        if (full) {
          return (
            <Star
              key={position}
              aria-hidden
              className="text-star fill-current"
              style={{ width: size, height: size }}
            />
          );
        }
        if (half) {
          // A real half-fill: the same glyph laid over itself and clipped, rather
          // than a second icon whose silhouette might not line up.
          return (
            <span
              key={position}
              aria-hidden
              className="relative inline-block shrink-0"
              style={{ width: size, height: size }}
            >
              <Star
                className={cn("absolute inset-0", empty)}
                style={{ width: size, height: size }}
              />
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: size / 2 }}
              >
                <Star
                  className="text-star fill-current"
                  style={{ width: size, height: size }}
                />
              </span>
            </span>
          );
        }
        return (
          <Star
            key={position}
            aria-hidden
            className={empty}
            style={{ width: size, height: size }}
          />
        );
      })}
    </span>
  );
}

export type RatingPillProps = {
  rating: number | null;
  count: number;
  onDark?: boolean;
  /**
   * The `(12)` after the average. Off on the browse card, where the count has its own
   * line — *"Salon · 12 reviews"* — and repeating it beside the star would state the
   * same number twice in two notations, two rows apart.
   */
  showCount?: boolean;
  className?: string;
};

/**
 * Compact rating for cards and list rows: one gold star, the average, the review
 * count. **An unrated salon reads "New"**, never 0.0 — treating null as zero would
 * report a brand-new salon as the worst in the marketplace.
 */
export function RatingPill({
  rating,
  count,
  onDark = false,
  showCount = true,
  className,
}: RatingPillProps) {
  const Star = Icons.star;

  if (count === 0 || rating == null) {
    return (
      <span
        className={cn(
          "text-badge font-semibold",
          onDark ? "text-on-primary" : "text-muted",
          className,
        )}
      >
        New
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", className)}
    >
      {/* Gold even on dark: the star holds contrast on both backdrops. */}
      <Star className="text-star size-[18px] shrink-0 fill-current" aria-hidden />
      <span
        className={cn(
          "text-caption font-semibold",
          onDark ? "text-on-primary" : "text-ink",
        )}
      >
        {rating.toFixed(1)}
      </span>
      {showCount ? (
        <span
          className={cn(
            "text-body-sm",
            onDark ? "text-on-primary/85" : "text-muted",
          )}
        >
          ({count})
        </span>
      ) : null}
    </span>
  );
}
