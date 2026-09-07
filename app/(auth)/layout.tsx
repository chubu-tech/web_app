import type { Viewport } from "next";
import Image from "next/image";
import Link from "next/link";

export const viewport: Viewport = { themeColor: "#ffffff" };

/**
 * The auth pages have no shell — no nav, no header.
 *
 * Deliberate: this is a single-purpose page, and the navigation would offer ways to
 * wander off mid-task. The one route out is the explicit "Browse without an account"
 * on the form itself, which is the app's own affordance (THO-24).
 *
 * It still carries `data-shell="customer"`, now only as the shell marker the rest of
 * the tree uses — the attribute stopped re-pointing any colour when the canvas moved to
 * the app's white and `[data-shell]`'s colour scope was deleted (see `globals.css`). The
 * seam it was guarding against is closed from the other side: every shell and the public
 * pages are on one ground.
 *
 * ## The brand, and why it is only here
 *
 * The app opens on a full-bleed crimson field with the gold mark on it, then hands off to
 * the launcher icon, which is the same mark on the same field. The web has no splash — a
 * visitor's first frame is whatever page they landed on — so the closest thing to that
 * moment is this one: the page where somebody decides whether to trust the site with a
 * password. That is the only reason `--color-brand-field` appears in the product at all,
 * and it appears exactly once.
 *
 * **The app's own auth screen does not look like this** — it is a flat `rausch` tile with
 * the scissors glyph, which is what this page mirrored until now. Elevating it to the
 * launch treatment is therefore a deliberate web-side change rather than a port, taken
 * because the app gets its brand moment for free from the OS and this page does not.
 * PARITY.md §4's decision is untouched: the brand reaches the auth surfaces, the
 * onboarding carousel does not reach anything.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      data-shell="customer"
      className="px-base py-xl bg-canvas relative flex flex-1 items-center justify-center"
    >
      <WarmWash />
      {/* `relative` so the form paints above the wash: the wash is positioned and would
          otherwise sit in front of in-flow content, whatever the DOM order. */}
      <div className="relative w-full max-w-[420px]">
        <div className="mb-lg flex flex-col items-center">
          <Link
            href="/discover"
            aria-label="Tho — back to browsing"
            className="bg-brand-field flex size-16 items-center justify-center rounded-lg"
          >
            {/*
              The real mark, mirrored byte-for-byte from `tho/app/assets/branding/logo_mark.png`
              (lossless WebP, pixel-identical, and smaller than the PNG). Not an icon from
              `Icons` — every glyph there is a UI symbol, and this is a piece of artwork with
              its own portrait proportion, which is why it takes a height and lets the width
              follow rather than a square from the icon scale.

              48 of 64 is upstream's own answer to "how big is the mark inside a square tile":
              measured off the launcher icon, the mark's bounding box is 75.5% of the tile
              height. Matching it is what makes this read as the icon on somebody's home
              screen rather than as a logo that happens to be crimson.

              `alt=""` for `BrandLockup`'s reason: the link carries the accessible name and
              the wordmark below is the visible one, so a third "Tho" would be noise.

              **`width`/`height` are the rendered box, not the file's 289x384**, which is
              `BrandLockup`'s convention and matters here: `next/image` builds its `srcSet`
              from the declared width, so the intrinsic values had it fetching a 384w and a
              640w re-encode to paint 36 CSS pixels. Declaring 36x48 asks for 48w and 96w
              instead — the 2x cap `AGENTS.md` already sets for photos, which a flat two-colour
              glyph is comfortably inside.
            */}
            <Image
              src="/tho-mark.webp"
              alt=""
              width={36}
              height={48}
              priority
              className="h-12 w-auto"
            />
          </Link>
          {/* "THO", matching the header lockup and the marketing site's `brand.name`. This
              is the page the marketing site's "Sign in" lands on, so it is the one place a
              second spelling would be seen back-to-back with the first. */}
          <p className="text-display-xl text-ink mt-lg font-bold tracking-tight">THO</p>
        </div>
        {children}
      </div>
    </main>
  );
}

/**
 * The warm gradient that lifts the top of the page off the canvas — `WarmWash` from
 * `onboarding/onboarding_art.dart`, at its values: rausch at 10%, at 3% by a third of
 * the way down, gone by three quarters.
 *
 * The gradient itself is `warm-wash` in `app/globals.css`, which is where its stops and the
 * reason for its end colour are written down. This component owns only the box it paints in.
 *
 * **Fixed height, not a percentage.** Upstream's stops are fractions of a hero that is
 * about 40% of a phone screen. Here the parent is `flex-1`, so percentage stops would
 * stretch the wash over the whole viewport — and its own comment is that "a tint that
 * runs the full height reads as a pink screen". 20rem keeps it a warm top edge at every
 * viewport height, and being in `rem` it grows with the type rather than staying put
 * under a zoomed-in form.
 */
function WarmWash() {
  return (
    <div aria-hidden className="warm-wash pointer-events-none absolute inset-x-0 top-0 h-80" />
  );
}
