import { CoverImage } from "./cover-image";
import { cn } from "@/lib/utils";

/**
 * The photo half of a salon card: a fixed-ratio, edge-to-edge cover with two overlay
 * slots and a hover zoom.
 *
 * It exists because three surfaces draw the same picture — the browse card
 * (`BusinessCard`), the Discover carousels and the map preview — and before this they
 * each owned a height, a radius and a badge position. Two of them had already drifted:
 * 150px against 110px, and a rating pill in a white disc against a coral pill, on cards
 * that sit on the same screen. All three go through `BusinessCard` now, so this has one
 * caller; it stays a component because the frame, the ratio and the zoom are one idea and
 * inlining them would put a magic aspect ratio in a layout file.
 *
 * ## 3:2, which is a change from 16:10
 *
 * Fresha's covers are about 1.44:1 and this was 1.6:1 — noticeably letterboxed beside
 * them. 3:2 is the nearest ratio that is a ratio rather than a measurement, and it is 15%
 * more photograph per card at the same width.
 *
 * ## The slots are named by position, because their treatment depends on it
 *
 * - `chip` is **top-left** — a distance, or the row's reason for showing this salon.
 *   Fresha's "Featured" corner.
 * - `action` is **top-right** and is the only interactive thing over the image, so it is
 *   also the only slot that gets a stacking order — the card's own link spreads an
 *   `::after` across the whole surface and would otherwise swallow the press.
 * - `chip` carries its own background. White copy straight on a photograph is the
 *   better-looking option and does not survive a light cover — the arithmetic is on
 *   `MediaChip` in `business-card.tsx`.
 *
 * **There is no bottom-left slot and no scrim any more.** Both existed to carry the
 * rating over the photograph; the rating sits beside the salon's name now, so a gradient
 * across the bottom of every cover would be dimming pictures to hold nothing.
 *
 * ## The zoom scales the clipping box, not the image
 *
 * `CoverImage` owns its own `object-cover` and exposes no handle on the `<img>`, so
 * the transform goes on its root and this wrapper does the clipping. That happens to
 * be the better arrangement anyway: the monogram fallback zooms with the photograph,
 * so the 4 of 13 live salons with no cover behave like the ones that have one instead
 * of sitting inert while their neighbours move.
 *
 * The scale is driven by `group-hover` / `group-has`, so **the caller must be the
 * `group`** — the hover target is the whole card, never the picture.
 */
export function CardMedia({
  label,
  imageUrl,
  sizes,
  priority = false,
  chip,
  action,
  className,
  alt,
}: {
  label: string;
  imageUrl?: string | null;
  sizes?: string;
  priority?: boolean;
  /** Passed through to `CoverImage`. Empty (decorative) unless the caller describes it. */
  alt?: string;
  /** Top-left. Bring your own background. */
  chip?: React.ReactNode;
  /** Top-right, above the card's own link overlay. */
  action?: React.ReactNode;
  /** Sizes the frame. Defaults to 3:2; pass a height to override the ratio. */
  className?: string;
}) {
  return (
    <div className={cn("relative w-full overflow-hidden aspect-[3/2]", className)}>
      <CoverImage
        label={label}
        imageUrl={imageUrl}
        sizes={sizes}
        priority={priority}
        alt={alt}
        className={cn(
          "h-full w-full",
          // Transform only, so the zoom stays on the compositor and costs no layout.
          "transition-transform duration-[var(--duration-slow)] ease-out-expo",
          "motion-safe:group-hover:scale-105",
          "motion-safe:group-has-[a:focus-visible]:scale-105",
        )}
      />

      {chip ? <span className="left-md top-md absolute">{chip}</span> : null}
      {action ? <span className="right-md top-md absolute z-10">{action}</span> : null}
    </div>
  );
}
