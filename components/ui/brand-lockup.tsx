import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The mark plus the wordmark — the product's name in the top-left of every shell.
 *
 * It exists because there were **three** copies of this markup: the customer header, the
 * root 404, and now the owner console needed a fourth. All three had drifted apart already
 * (the 404's tile did not tilt on hover), and a logo that renders differently depending on
 * which shell you are in is the one thing a logo cannot do.
 *
 * Two details that are decisions rather than styling:
 *
 * - **`alt=""`.** The wordmark beside it is the accessible name and the link carries
 *   `aria-label`; two copies of "Tho" to a screen reader is worse than none.
 * - **`rounded-full`, and it is the same call in all four places the mark renders.** This
 *   used to be `rounded-md` (14px) here and in the marketing footer, while both header
 *   marks were `rounded-xl` — 32px against a 36px box, which the browser clamps to a
 *   circle. So the product wore a rounded square and the public site wore a circle, from
 *   one asset, and the difference was invisible in the class names. Stating the radius
 *   rather than relying on the clamp is what stops that happening again: change the tile
 *   size and `rounded-xl` silently stops being round.
 *
 * The 12° tilt over 500ms on `../landing_page`'s easing curve is `site-header.tsx`'s own
 * hover, and it sits on the **tile** rather than the whole lockup, matching it. A circle
 * is the one shape a rotation cannot reveal, so the tilt now reads only on the artwork
 * inside — which is the intent, since the syllable is the thing that should lean.
 */
export function BrandLockup({
  href = "/",
  label = "Tho — home",
  priority = false,
  className,
}: {
  /** Where the logo goes. `/business` for the console: `/` only redirects an owner there. */
  href?: string;
  /** The link's accessible name. */
  label?: string;
  /** Eager-load the mark. True in a shell header, false on an error page. */
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn("gap-sm flex shrink-0 items-center", className)}
    >
      <Image
        src="/tho-logo.webp"
        alt=""
        width={36}
        height={36}
        priority={priority}
        className="size-9 shrink-0 rounded-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:rotate-12"
      />
      {/* "THO" in ink, not "Tho" in rausch. `brand.name` on the marketing site is the
          uppercase form and its wordmark is `text-ink`; the pink mixed-case version was a
          third spelling of the product's own name. `brand.appName` stays cased "Tho"
          upstream because that is literally the Android label — a casing distinction, not a
          naming one, so do not reconcile them. */}
      <span className="text-display-md text-ink font-bold tracking-tight">THO</span>
    </Link>
  );
}
