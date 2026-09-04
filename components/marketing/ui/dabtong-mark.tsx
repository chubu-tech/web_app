import { supporter } from "@/lib/marketing/content";
import {
  MARK_PATH,
  MARK_TRANSFORM,
  MARK_VIEWBOX,
} from "@/lib/marketing/dabtong-logo";
import { cn } from "@/lib/marketing/utils";

/**
 * The Dabtong House lattice, on its own. **A server component with no motion in it.**
 *
 * That is the point of it existing separately from `SupporterCredit`. The animated
 * lockup is in the home page's hero only, and like every entrance on this site it starts
 * at `opacity: 0` — so with scripting off the credit would be a blank rectangle. This
 * renders in the HTML, on all six marketing routes, with nothing to hydrate.
 */
export function DabtongMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={cn("shrink-0", className)}
      fill="currentColor"
      aria-hidden
    >
      <path transform={MARK_TRANSFORM} d={MARK_PATH} />
    </svg>
  );
}

/**
 * The footer's one-line supporter credit: the mark, then the name as text.
 *
 * ## Why the name is set rather than drawn
 *
 * The band upstairs renders the real wordmark, because at 26rem it is legible and it is
 * the identity as its owner drew it. Down here the lockup would be about 90px wide, at
 * which point the wordmark is a grey smear — and it would put 7.5 KB of glyph outlines
 * into every marketing page's payload to achieve that. A mark plus a caption is the
 * ordinary way a credit line is set, and it is the legible one.
 *
 * The mark is the part that survives the size, so the mark is the part that is drawn.
 *
 * ## `text-body`, not `text-ink`
 *
 * This sits in the mast beside the contact rows, which are `text-muted` labels over
 * `text-ink` values. A credit is neither — it is not the site's own identity and it is
 * not a thing to act on — so it takes the reading weight in between and does not
 * compete with THO's own wordmark two lines above it.
 */
export function DabtongCredit({ className }: { className?: string }) {
  const linked = supporter.href.length > 0;

  const inner = (
    <>
      <DabtongMark className="text-body size-5" />
      <span className="flex flex-col">
        <span className="text-muted text-caption">{supporter.footerLabel}</span>
        <span className="text-ink text-body-sm">{supporter.name}</span>
      </span>
    </>
  );

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {linked ? (
        <a
          href={supporter.href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-rausch flex items-center gap-2.5 transition-colors duration-200"
        >
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
