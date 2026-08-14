import { cn } from "@/lib/marketing/utils";

/**
 * Bhutanese decorative motifs. All of these are ornament — never the only
 * carrier of meaning — so they are `aria-hidden` and safe to drop.
 */

/**
 * Kira-weave rule: the thin stripe band you see in Bhutanese textiles and on
 * dzong trim. Used to open the hero and to close sections.
 */
export function TextileRule({
  className,
  draw = false,
}: {
  className?: string;
  /** Wipe the stripes in from the left on mount (CSS only). */
  draw?: boolean;
}) {
  // Widths are deliberately uneven — an even repeat reads as a progress bar.
  const stripes = [
    { color: "bg-maroon", w: "w-10" },
    { color: "bg-saffron", w: "w-4" },
    { color: "bg-rausch", w: "w-14" },
    { color: "bg-saffron", w: "w-2" },
    { color: "bg-jade", w: "w-8" },
    { color: "bg-maroon", w: "w-3" },
    { color: "bg-saffron", w: "w-16" },
  ];

  /*
    The kira weave keeps all four colours, and it is the **only** place on the site
    that saffron, maroon and jade still appear. That is the point of it: a woven
    band is where a palette belongs, and confining them here is what lets the rest
    of the page hold to one accent without the brand losing its Bhutanese voice.
  */

  return (
    <span
      className={cn(
        "inline-flex h-1 origin-left overflow-hidden rounded-full",
        draw && "animate-draw-x",
        className,
      )}
      aria-hidden
    >
      {stripes.map((stripe, i) => (
        <span key={i} className={cn("h-full", stripe.color, stripe.w)} />
      ))}
    </span>
  );
}

/**
 * A slow drifting band of woven diamonds, used once as a divider between
 * sections so the scroll never goes fully still.
 */
export function MotifDivider({ className }: { className?: string }) {
  const run = Array.from({ length: 14 });

  return (
    <div
      className={cn("mask-edges flex w-full overflow-hidden py-2", className)}
      aria-hidden
    >
      <div className="animate-marquee-slow flex w-max shrink-0 items-center">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0 items-center">
            {run.map((_, i) => (
              <span key={i} className="flex items-center gap-6 px-3">
                {/* Rausch, not saffron. The single-accent rule means the ornament
                    tints toward the brand colour rather than introducing a second
                    one; at 35% it is a tone rather than a statement. */}
                <MotifDiamond className="text-rausch/35 size-4" />
                <span className="bg-hairline-soft h-px w-16" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Woven-diamond motif — the interlaced lattice found on Bhutanese window
 * frames and fabric borders, simplified to read at small sizes. Used as the
 * separator in the services ticker and beside eyebrow labels.
 */
export function MotifDiamond({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-4 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Outer diamond. */}
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12z" />
      {/* Inner weave: two bars crossing with gaps at the overlap. */}
      <path d="M12 7v3.2M12 13.8V17" />
      <path d="M7 12h3.2M13.8 12H17" />
      <path d="M9.4 9.4h5.2v5.2H9.4z" />
    </svg>
  );
}

/**
 * Himalayan skyline. Sits at the foot of the download band so the page closes
 * on a Bhutanese horizon rather than a hard edge.
 */
export function MountainRule({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      className={cn("block w-full", className)}
      aria-hidden
    >
      {/* Far range. */}
      <path
        d="M0 120 L0 78 L120 40 L215 82 L330 26 L470 90 L585 48 L700 96 L820 34 L940 86 L1060 44 L1200 92 L1200 120 Z"
        fill="currentColor"
        opacity="0.35"
      />
      {/* Near range. */}
      <path
        d="M0 120 L0 100 L140 68 L260 104 L390 58 L520 108 L650 72 L790 110 L910 66 L1040 104 L1200 74 L1200 120 Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}
