import { CoverImage } from "./cover-image";
import { cn } from "@/lib/utils";

/**
 * The photo half of a salon card: a fixed-ratio, edge-to-edge cover with three
 * overlay slots and a hover zoom.
 *
 * It exists because three surfaces draw the same picture — the browse card
 * (`BusinessCard`), the Discover carousels (`SalonScroller`) and the map preview —
 * and before this they each owned a height, a radius and a badge position. Two of
 * them had already drifted: 150px against 110px, and a rating pill in a white disc
 * against a coral pill, on cards that sit on the same screen.
 *
 * ## The slots are named by position, because their treatment depends on it
 *
 * - `badge` is **bottom-left**, where the frame meets whatever is under it.
 * - `chip` is **top-left.** There is no scrim at the top of the frame, and adding a
 *   second one would box the photo in from both ends.
 * - Both carry their own background. White copy straight on the gradient is the
 *   better-looking option and does not survive a light cover — the arithmetic is in
 *   `BusinessCard`, at the badge that used to do it.
 * - `action` is **top-right** and is the only interactive thing over the image, so it
 *   is also the only slot that gets a stacking order — the card's own link spreads an
 *   `::after` across the whole surface and would otherwise swallow the press.
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
  badge,
  scrim = false,
  className,
}: {
  label: string;
  imageUrl?: string | null;
  sizes?: string;
  priority?: boolean;
  /** Top-left. Bring your own background. */
  chip?: React.ReactNode;
  /** Top-right, above the card's own link overlay. */
  action?: React.ReactNode;
  /** Bottom-left. */
  badge?: React.ReactNode;
  /**
   * The bottom gradient. Off by default: it earns its place where the frame's bottom
   * edge butts into a card body — it grounds the photograph there instead of letting it
   * stop dead — and only dims the picture where the frame ends on open canvas, which is
   * the carousels.
   */
  scrim?: boolean;
  /** Sizes the frame. Defaults to 16:10; pass a height to override the ratio. */
  className?: string;
}) {
  return (
    <div className={cn("relative w-full overflow-hidden aspect-[16/10]", className)}>
      <CoverImage
        label={label}
        imageUrl={imageUrl}
        sizes={sizes}
        priority={priority}
        className={cn(
          "h-full w-full",
          // Transform only, so the zoom stays on the compositor and costs no layout.
          "transition-transform duration-[var(--duration-slow)] ease-out-expo",
          "motion-safe:group-hover:scale-105",
          "motion-safe:group-has-[a:focus-visible]:scale-105",
        )}
      />

      {scrim ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
        />
      ) : null}

      {badge ? <span className="left-md bottom-md absolute">{badge}</span> : null}
      {chip ? <span className="left-md top-md absolute">{chip}</span> : null}
      {action ? <span className="right-md top-md absolute z-10">{action}</span> : null}
    </div>
  );
}
