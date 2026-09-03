"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icons, IconSize } from "@/components/ui/icons";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { launcherLift } from "@/lib/guide/placement";
import { GUIDE_SUMMARIES } from "@/lib/guide/summary";
import type { GuideAudience } from "@/lib/guide/timeline";
import { cn } from "@/lib/utils";

/**
 * The player is **loaded on press**, not on page load.
 *
 * `next/dynamic` with the component behind a condition is the documented "load on demand,
 * only when/if the condition is met" shape (`node_modules/next/dist/docs/01-app/02-guides/
 * lazy-loading.md`). So a visitor who never opens the guide pays for this button and nothing
 * else — no player, and none of the film: `preload="none"` on the `<video>` means even the
 * mounted player fetches only its poster until somebody presses play. A 34 MB download
 * cannot start by accident.
 *
 * No `ssr: false` needed: the import is only reached once `open` is true, which cannot happen
 * during a server render.
 */
const GuidePlayer = dynamic(() => import("./guide-player").then((m) => m.GuidePlayer));

/**
 * The floating "How it works" button, and the walkthrough behind it.
 *
 * Mounted once per shell — the customer layout passes `customer`, the owner console passes
 * `owner` — so every page in a shell offers the guide its own audience needs, and no page has
 * to know the feature exists.
 *
 * ## The two shells that deliberately do not mount it
 *
 * `app/(auth)` is sign-in and sign-up, and its own doc comment explains why it has no nav:
 * *"this is a single-purpose page, and the navigation would offer ways to wander off
 * mid-task."* A floating button offering a five-minute film is precisely that. It is also the
 * one surface where the audience is unknowable — a salon owner and a customer sign in through
 * the same form, and there is no evidence to guess from, so guessing would show one of them
 * the wrong walkthrough.
 *
 * `app/staff` is a third role, and there is no third film. Offering a staff member the owner
 * walkthrough would show them a console of features they do not have.
 *
 * Both are decisions rather than oversights, which is why they are written down here: a
 * coverage sweep finds two shells without a launcher and cannot tell the difference.
 *
 * ## Two decisions about not getting in the way
 *
 * **Where it sits** is `lib/guide/placement.ts`, which knows the six surfaces that pin a
 * control to the bottom edge and lifts the button clear of them, and the one route (`/map`)
 * where it is not drawn at all because OpenStreetMap's required attribution owns that corner.
 * That rule is tested; this component only spends its answer.
 *
 * **What it looks like** is the quieter half of the same problem. A coral pill in the corner
 * of every page would compete with the actual call to action on the pages that have one —
 * "Book · Nu 350" is the thing a customer came for, and a help button must never look more
 * important than it. So this is a paper surface with a hairline and ink text, and the brand
 * coral appears only in the glyph. It reads as an offer rather than an instruction.
 *
 * Below 744 it is an icon-only circle: at 390px a labelled pill is a third of the screen
 * width, and the label is the first thing that can go.
 */
export function GuideLauncher({
  audience,
  /**
   * Whether `CartBar` is on screen, so the button can clear it.
   *
   * A prop rather than a `useCart()` here: `CartBar` is mounted by the customer layout alone,
   * so in the console and on the marketing site this is structurally always `false` — and
   * reading the cart to learn that subscribed every one of those pages to `localStorage` for
   * an answer that could not vary. `CustomerGuideLauncher` is the one caller that passes it,
   * through `useCartBarVisible`, which is the bar's own rule rather than a copy of it.
   */
  cartVisible = false,
}: {
  audience: GuideAudience;
  cartVisible?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /*
    Two of the CTA footers the button clears are `desktop:hidden`, so above 1128 there is
    nothing under it on the salon page or the booking wizard. `launcherLift` has taken `wide`
    since it was written and nothing ever passed it, which left the button floating 112px up
    with empty space beneath it on the busiest route in the product — deference to a bar that
    is not there reads as a bug.

    `useMediaQuery` answers `false` before hydration, which is the conservative direction: the
    button starts lifted and settles, rather than starting on the corner and jumping up over a
    footer it should have cleared all along.
  */
  const wide = useMediaQuery("(min-width: 1128px)");

  const summary = GUIDE_SUMMARIES[audience];
  const lift = launcherLift({ pathname, cartVisible, wide });

  if (lift === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Below 744 the label is not rendered, so without this the button is a glyph with no
        // name. The two facts after it are the ones somebody uses to decide whether to start
        // now: how long it runs, and that it is divided rather than one unbroken block.
        aria-label={`${summary.title} — ${summary.chapters} chapters, ${summary.runLabel.toLowerCase()}`}
        style={{ "--guide-lift": `${lift}px` } as React.CSSProperties}
        className={cn(
          "fixed right-4 z-30 tablet:right-6",
          // The lane, plus the iOS home indicator. `--guide-lift` rather than a class per
          // case: the value is computed, and a matrix of route-by-breakpoint offsets is how
          // one page ends up with the button on top of its own footer.
          "bottom-[calc(var(--guide-lift)+env(safe-area-inset-bottom))]",
          "border-hairline bg-paper text-ink shadow-lift gap-sm flex min-h-12 items-center rounded-full border",
          "hover:border-border-strong transition-colors duration-[var(--duration-fast)]",
          // Icon-only below 744, labelled above it.
          "size-12 justify-center px-0 tablet:size-auto tablet:px-4",
        )}
      >
        <Icons.guide
          className="text-rausch-cta shrink-0"
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
        <span className="text-title hidden font-medium tablet:inline">How it works</span>
      </button>

      {open ? <GuidePlayer audience={audience} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
