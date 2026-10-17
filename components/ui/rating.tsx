import { Icons, IconSize } from "./icons";
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

/**
 * The interactive form of `StarBar` — five whole stars, as a radio group.
 *
 * Extracted from `review-sheet.tsx`, which had the only copy, at the moment a second surface
 * needed one. Two private star pickers is how one gesture drifts into two controls that
 * disagree about their own keyboard behaviour, which is the same reasoning that moved
 * `MenuSheet` out of the chat menu.
 *
 * **Radios, not buttons.** A rating is one answer to one question, so the platform's own
 * roving-focus and arrow-key behaviour is exactly right and comes free; five buttons would
 * mean re-implementing it and announcing five unrelated controls. The inputs are `sr-only`
 * and the glyphs are `aria-hidden`, so what a screen reader hears is "3 stars, radio button,
 * selected" rather than a row of pictures.
 *
 * **Whole stars only**, which is why it draws `Icons.star` directly rather than going through
 * `StarBar`: a picker cannot produce a half, so the half-fill machinery would be dead weight
 * and a second interpretation of the same glyph.
 *
 * `name` must be unique on the page — a list of products each with its own picker is a list of
 * separate radio groups, and sharing a name would make them one, so rating the shampoo would
 * un-rate the conditioner.
 */
export function StarPicker({
  value,
  onChange,
  name,
  label = "Your rating out of 5",
  size = IconSize.xl,
  disabled = false,
  className,
}: {
  /** 1–5, or 0 for "not rated yet" — which lights no stars. */
  value: number;
  onChange: (value: number) => void;
  name: string;
  label?: string;
  size?: number;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <fieldset disabled={disabled} className={className}>
      <legend className="sr-only">{label}</legend>
      <div className="gap-xs flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const lit = star <= value;
          return (
            <label
              key={star}
              className={cn(
                "flex items-center justify-center",
                // The 48px target the kit holds everywhere, independent of the glyph size,
                // so a compact picker in a list row is still thumb-sized.
                "size-12",
                disabled ? "cursor-default opacity-60" : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                className="sr-only"
              />
              <span className="sr-only">
                {star} star{star === 1 ? "" : "s"}
              </span>
              <Icons.star
                aria-hidden
                style={{ width: size, height: size }}
                className={cn(
                  "transition-transform duration-[var(--duration-fast)]",
                  lit
                    ? "text-star scale-100 fill-current drop-shadow-[0_0_12px_rgba(232,163,23,0.35)]"
                    : "text-hairline scale-[0.88]",
                )}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
