"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The one piece of chrome both shells share, and the only navigation either has since the
 * bottom tab bars were removed.
 *
 * ## Two deliberate divergences from the marketing site's header
 *
 * **`sticky`, not `fixed`.** `landing_page`'s header floats over the page, which works on
 * a one-route site whose hero is designed around it and would mean every one of 46 routes
 * here needed top padding. A sticky in-flow header keeps `main` starting below the chrome,
 * so `/salon/[id]`'s sticky rail still works and the map's height stays a single
 * subtraction.
 *
 * **A constant outer height; condensing restyles the inner container only.**
 * `landing_page` shrinks its header on scroll. `--header-height` is subtracted by the map
 * page, so a header whose height changed as you scrolled would make that arithmetic wrong
 * the moment you moved. Here the 64px box is fixed and only what sits inside it changes:
 * the inner row gains a paper fill, a full radius, a shadow and a blur, so it reads as a
 * floating pill on a page that has started moving.
 *
 * `condensed` comes from an `IntersectionObserver` on a 1px sentinel rather than a scroll
 * listener, so it is one boolean flip instead of a re-render per pixel.
 *
 * **Full-bleed, capped by nothing.** It used to be centred and capped at 1440, which on a
 * 1920px display put the wordmark 264px in from the left edge — level with Discover's
 * filter rail, because that page was capped to the same 1440. Now the browse pages fill
 * the viewport, so the only measurement the chrome and the page share is the gutter
 * (`px-base` / `tablet:px-lg`). A cap here would re-inset the header from the content it
 * labels. The narrower pages — the 720px forms, the 1128px console — stay centred columns
 * under a full-width bar, which is what they already were.
 *
 * **The collapse width is the caller's, not this file's.** It was `tablet:` for both shells,
 * which is wrong for the console: five labelled tabs beside a salon switcher and a bell need
 * more room than five beside a two-character wordmark. Hard-coding one breakpoint here meant
 * whichever shell it did not suit had to work around it in the caller, which is how a shared
 * component grows conditionals. One prop, two literal class strings — literal because
 * Tailwind scans for whole candidates and a composed `${x}:block` compiles to nothing.
 */

/*
 * `overflow-x-auto` lives here, on the nav region, and **not** on the destination list
 * inside it. That pairing is what lets the list centre safely: the list is `w-max mx-auto`,
 * so while it fits it is centred in this region — the marketing site's proportion, brand
 * left, destinations in the middle, actions right — and once it does not fit, `w-max`
 * exceeds the region, `mx-auto` resolves to zero, and this element scrolls from the true
 * start. Putting `justify-center` on the list instead is the version that breaks: centred
 * flex content that overflows pushes its first item off the scrollable origin, and the
 * customer shell's five labelled tabs do overflow at 744.
 */
const COLLAPSE = {
  tablet: "hidden min-w-0 flex-1 overflow-x-auto tablet:block",
  console: "hidden min-w-0 flex-1 overflow-x-auto console:block",
  // The staff shell has **two** destinations, so they fit beside a name and a sign-out at
  // 390px with room to spare — there is nothing to collapse and therefore no hamburger to
  // offer them from. A shell that collapsed two items would be hiding them for no reason.
  always: "min-w-0 flex-1 overflow-x-auto",
} as const;

export function AppHeader({
  left,
  nav,
  right,
  navFrom = "tablet",
  label,
}: {
  left: React.ReactNode;
  /** Inline destinations, shown from `navFrom` up and hidden below it. */
  nav?: React.ReactNode;
  right: React.ReactNode;
  /**
   * The width at which `nav` comes inline: `tablet` (744) for the customer shell,
   * `console` (1024) for the owner console. Below it the caller is expected to offer the
   * same destinations some other way — both shells use the collapse panel.
   */
  navFrom?: keyof typeof COLLAPSE;
  label: string;
}) {
  const [condensed, setCondensed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCondensed(!entry!.isIntersecting),
      { threshold: 1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* The 1px tripwire. Above the header in the document, so it leaves the viewport the
          moment the page scrolls at all. */}
      <div ref={sentinel} aria-hidden className="h-px" />

      {/*
        `fixed` and **transparent**, which is `../landing_page`'s strategy exactly.

        This was `sticky` with `bg-canvas` and a bottom hairline, and that is what made the
        whole header *section* look like it was moving on scroll rather than just the navbar:
        a sticky element paints its own background, so the cream fill and the seam travelled
        down the viewport as a full-width band with the pill floating inside it. The pill was
        never the problem — the bar behind it was.

        Transparent outer means only the condensed pill paints, so page content scrolls
        visibly past it on both sides and behind its blur, which is the marketing site's look.
        `fixed` takes it out of flow so no parent background can follow it.
      */}
      <header className="fixed inset-x-0 top-0 z-30">
        {/*
          A plain container, not a `<nav>`. The wrapper used to be the labelled `<nav>`,
          which put the whole header — wordmark, bell, sign-in, and the second row's own
          `<nav>` — inside one landmark, nesting a nav in a nav and making
          `nav[aria-label]` match far more than the destinations. Only the destination
          lists are navigation; the rest is chrome.
        */}
        {/*
          Capped and centred at 86rem. `../landing_page`'s own `Section` container is 82rem;
          this is that plus a small margin, asked for after seeing the two side by side —
          the condensed pill read narrow against the band it floats on.
          It was full-bleed, which is why the two headers still read as different chrome even
          once the links matched: the marketing nav sits in a 1312px column and this one ran
          to both edges of a 1920px display. The gutters are landing's too (24 → 32), not the
          16 → 24 this used, which is the other half of "clustered and forced".

          Note this caps the **header only**. Discover's grid stays full-bleed on purpose —
          that was the fix for the 264px blank band — so above 1312px the wordmark is inset
          from the filter rail. That is the marketing site's own proportion and the price of
          matching it.
        */}
        <div className="px-lg tablet:px-xl mx-auto w-full max-w-[86rem]">
          <div
            className={cn(
              // h-19 is 76px, which is `--header-height`. The two MUST agree: the token is
              // what `/map` subtracts from `100svh` and what `/salon/[id]`'s sticky rail
              // offsets by, so a row taller than the token pushes the map off-screen by the
              // difference and no test would catch it.
              "gap-base flex h-19 items-center transition-all duration-[var(--duration-base)]",
              // The floating pill on scroll, for **every** shell. `tone` used to gate this so
              // the console stayed square, which meant the one piece of chrome the whole
              // product shares behaved differently depending on who was signed in — the same
              // split the canvas had, in the same place, for the same unmeasured reason. The
              // `tone` prop existed only to gate it, so it is gone rather than left dead.
              // 56px tall inside 10px of margin top and bottom — 76px again, so the outer box
              // never changes height and nothing shifts when the pill engages. It was 48px
              // inside 8px, i.e. 64px, which read as a thin strip beside the marketing site's
              // pill. `px-5` matches landing's condensed horizontal padding.
              condensed
                ? "bg-paper/80 shadow-card my-2.5 h-14 rounded-full px-5 backdrop-blur-xl"
                : null,
            )}
          >
            {left}
            {nav ? (
              <nav aria-label={label} className={COLLAPSE[navFrom]}>
                {nav}
              </nav>
            ) : null}
            {/* `ml-auto` unconditionally. It used to be cancelled from `tablet:` up, on the
                reasoning that the flex-1 nav had already eaten the free space — true, which
                is what made it a no-op there and a bug once `navFrom` could be wider than
                `tablet`: between 744 and 1024 the console's nav is `display: none`, so
                cancelling the auto margin parked the bell and the hamburger against the
                salon switcher instead of the right edge. */}
            <div className="gap-xs ml-auto flex shrink-0 items-center">{right}</div>
          </div>
        </div>
      </header>

      {/*
        The spacer that pays for `fixed`, and the reason this change touched no other file.

        A fixed header occupies no space, so without this every page's first row would start
        under the chrome. One in-flow div of exactly `--header-height` puts `main` back where
        `sticky` had it — which is what keeps `/map`'s `100svh` minus the token correct and
        `/salon/[id]`'s sticky rail offset correct, with neither needing to know the header
        stopped being sticky. Padding on `main` in three shell layouts would have done the
        same job in three places instead of one.

        `shrink-0` because both shells are `min-h-full flex flex-col`: a flex child with a
        height and no shrink guard is a flex child that can be compressed to nothing.
      */}
      <div aria-hidden className="h-[var(--header-height)] shrink-0" />
    </>
  );
}
