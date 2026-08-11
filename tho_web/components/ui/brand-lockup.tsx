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
 * - **`rounded-md` (14px), not the editorial `slab`.** 2rem on a 36px box is a circle.
 *   This tile is chrome, so it takes the product radius scale even on the cream canvas.
 *
 * The 12° tilt over 500ms on `../landing_page`'s easing curve is `site-header.tsx`'s own
 * hover, and it sits on the **tile** rather than the whole lockup, matching it.
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
        src="/tho-logo.jpg"
        alt=""
        width={36}
        height={36}
        priority={priority}
        className="size-9 shrink-0 rounded-md object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:rotate-12"
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
