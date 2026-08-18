"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icons, IconSize } from "@/components/ui/icons";
import { launcherLift } from "@/lib/guide/placement";
import { GUIDE_SUMMARIES } from "@/lib/guide/summary";
import type { GuideAudience } from "@/lib/guide/steps";
import { cn } from "@/lib/utils";

/**
 * The player is **loaded on press**, not on page load.
 *
 * `next/dynamic` with the component behind a condition is the documented "load on demand,
 * only when/if the condition is met" shape (`node_modules/next/dist/docs/01-app/02-guides/
 * lazy-loading.md`). So a visitor who never opens the guide pays for this button and
 * nothing else — no player, no step data, and none of the sixteen frames, which are
 * `next/image` sources inside the player and therefore not requested until it mounts.
 *
 * No `ssr: false` needed: the import is only reached once `open` is true, which cannot
 * happen during a server render.
 */
const GuidePlayer = dynamic(() => import("./guide-player").then((m) => m.GuidePlayer));

/**
 * The floating "How it works" button, and the guide behind it.
 *
 * Mounted once per shell — the customer layout passes `customer`, the owner console passes
 * `owner` — so every page in a shell offers the guide its own audience needs, and neither
 * page has to know the feature exists.
 *
 * ## Two decisions about not getting in the way
 *
 * **Where it sits** is `lib/guide/placement.ts`, which knows the six surfaces that pin a
 * control to the bottom edge and lifts the button clear of them, and the one route (`/map`)
 * where it is not drawn at all because OpenStreetMap's required attribution owns that
 * corner. That rule is tested; this component only spends its answer.
 *
 * **What it looks like** is the quieter half of the same problem. A coral pill in the
 * corner of every page would compete with the actual call to action on the pages that have
 * one — "Book · Nu 350" is the thing a customer came for, and a help button must never look
 * more important than it. So this is a paper surface with a hairline and ink text, and the
 * brand coral appears only in the glyph. It reads as an offer rather than an instruction.
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

  const summary = GUIDE_SUMMARIES[audience];

  const lift = launcherLift({ pathname, cartVisible });

  if (lift === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${summary.title} — ${summary.steps} steps, ${summary.runLabel.toLowerCase()}`}
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
