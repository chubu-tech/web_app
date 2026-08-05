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

const COLLAPSE = {
  tablet: "hidden min-w-0 flex-1 tablet:block",
  console: "hidden min-w-0 flex-1 console:block",
} as const;

export function AppHeader({
  left,
  nav,
  right,
  navFrom = "tablet",
  tone = "console",
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
  /** `editorial` rounds and lifts the condensed row; `console` keeps it square. */
  tone?: "editorial" | "console";
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

      <header
        className={cn(
          "bg-canvas sticky top-0 z-30",
          // The border is on the header, not the inner row: it is the seam between chrome
          // and page, and it should not round with the pill.
          condensed ? "border-hairline border-b" : "border-b border-transparent",
        )}
      >
        {/*
          A plain container, not a `<nav>`. The wrapper used to be the labelled `<nav>`,
          which put the whole header — wordmark, bell, sign-in, and the second row's own
          `<nav>` — inside one landmark, nesting a nav in a nav and making
          `nav[aria-label]` match far more than the destinations. Only the destination
          lists are navigation; the rest is chrome.
        */}
        <div className="px-base tablet:px-lg w-full">
          <div
            className={cn(
              "gap-base flex h-16 items-center transition-all duration-[var(--duration-base)]",
              tone === "editorial" && condensed
                ? "bg-paper/80 shadow-card my-2 h-12 rounded-full px-4 backdrop-blur-xl"
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
    </>
  );
}
