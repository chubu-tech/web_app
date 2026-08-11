"use client";

import Link from "next/link";
import { useState } from "react";
import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import type { Business } from "@/lib/types/salon";

/**
 * Which salon the console is showing, and how to change it — a port of
 * `business_home.dart`'s `_SalonTitle` and `_showSalonPicker`.
 *
 * ## Its own row, not a dropdown in the nav bar
 *
 * This used to be the owner header's `left` slot, where every other nav in the product puts
 * the logo. It is a **row of its own** now, directly under the chrome and inside the
 * console's 1128px column, because the salon is not chrome:
 *
 * - **It is page context.** Changing it changes what every figure on the screen means — it
 *   is closer to a date range than to a menu. Sitting in a fixed bar it stayed on screen
 *   claiming to be navigation; here it scrolls away with the content it qualifies.
 * - **It gets to be legible.** In the bar it was a name over `Owner · Growth plan` competing
 *   with five destinations and a bell for width, capped at 320px and truncating at the first
 *   long salon name. A full row fits the cover photo, so the switcher looks like the sheet it
 *   opens, and the plan is a pill rather than a caption.
 * - **The header got its wordmark back**, which is the other half of the same change. See
 *   `owner-nav.tsx`.
 *
 * **Absent, not empty, when there is no salon.** The old header had to say *"No salon yet"*
 * because leaving its left slot blank would have been a hole in the chrome. A row can simply
 * not be there, and `NoSalonYet` fills the page below with the same "Add a salon" link — so
 * the console no longer states the empty case twice.
 *
 * ## Unchanged from the bar version, and load-bearing
 *
 * **The whole row opens the sheet, on a salon of one as much as nine.** 3a kept the app's
 * rule — tappable only when `allBusinesses.length > 1`, because a control that opens a list
 * of one lies about having a choice. 3b changed it, because the sheet ends in **Add a salon**
 * and so is never a list of one: an owner with a single shop opening a second has to be able
 * to reach the form. The label says which case it is rather than promising a switch that
 * isn't there.
 *
 * Each row is a real form `POST` to `/business/active-salon`, not an `onClick`. That is what
 * lets the switch set an `httpOnly` cookie the server layout can read on the very next
 * render — the app can use `SharedPreferences` because its shell re-reads on the client,
 * whereas here the salon has to be known *before* the first row is drawn. It also means
 * switching works with no JavaScript at all.
 *
 * The plan pill is the app's drawer header line, `Owner · <Plan> plan`, and it is the only
 * place the console states the tier — which is why a locked tab elsewhere never has to
 * explain which one the salon is on.
 */
export function SalonSwitcher({
  active,
  businesses,
}: {
  active: Business | null;
  businesses: Business[];
}) {
  const [open, setOpen] = useState(false);

  // An owner with no salon at all: an operator created the account before the shop. Nothing
  // to qualify, so no row — see the note above.
  if (!active) return null;

  const many = businesses.length > 1;

  return (
    <div className="px-base tablet:px-lg pt-lg mx-auto w-full max-w-[1128px]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        /* `p-sm` with an `md` radius on a `sm`-radius thumbnail: the tile's corners have to
           be tighter than the box that holds them or the inset reads as a mistake. */
        className="border-hairline-soft bg-paper hover:border-hairline gap-base p-sm flex w-full items-center rounded-md border text-left transition-colors duration-[var(--duration-fast)]"
      >
        {/*
          `size-full` on the `CoverImage` itself, not only on this span — and it is the
          difference between a cover photo and nothing at all.

          `CoverImage` renders `relative overflow-hidden` with **no height of its own** (its
          own doc says the wrapper "must be given a size") and fills itself with either a
          `next/image` `fill`, which is `position: absolute`, or a `h-full w-full` gradient.
          Both measure against their parent, so a sized *grandparent* is no help: the span
          was 44×44 and the div inside it 44×**0**, with the image collapsed to nothing.
          Measured, after it rendered as an empty gap on screen.
        */}
        <span className="size-11 shrink-0 overflow-hidden rounded-sm">
          <CoverImage
            label={active.name}
            imageUrl={active.coverUrl}
            sizes="44px"
            className="size-full"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-title text-ink block truncate font-semibold">
            {active.name}
          </span>
          <span className="text-caption-sm text-muted block truncate">
            Owner · {planLabel(active.plan)} plan
          </span>
        </span>

        {/* The count, and only when there is one worth stating. An owner running nine salons
            is the seeded case and the reason this control exists at all; an owner running one
            is told what the sheet actually offers instead of being promised a switch. */}
        <span className="text-title text-muted gap-xs mr-xs hidden shrink-0 items-center font-medium tablet:flex">
          {many ? `Switch salon · ${businesses.length}` : "Your salons"}
        </span>
        <Icons.chevronDown
          className="text-muted mr-xs shrink-0"
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Your salons">
        <ul className="divide-hairline-soft divide-y">
          {businesses.map((b) => {
            const current = b.id === active.id;
            return (
              <li key={b.id}>
                <form action="/business/active-salon" method="post">
                  <input type="hidden" name="businessId" value={b.id} />
                  <button
                    type="submit"
                    aria-current={current ? "true" : undefined}
                    className="gap-base py-md hover:bg-surface-soft flex w-full items-center text-left"
                  >
                    {/* `size-full` for the same reason as the row above. These nine
                        thumbnails have never rendered either. */}
                    <span className="size-11 shrink-0 overflow-hidden rounded-sm">
                      <CoverImage
                        label={b.name}
                        imageUrl={b.coverUrl}
                        sizes="44px"
                        className="size-full"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-title text-ink block truncate font-medium">
                        {b.name}
                      </span>
                      <span className="text-caption-sm text-muted block truncate">
                        {b.addressText ?? planLabel(b.plan)}
                      </span>
                    </span>
                    {current ? (
                      <Icons.success
                        className="text-rausch shrink-0"
                        style={{ width: IconSize.sm, height: IconSize.sm }}
                        aria-label="Currently showing"
                      />
                    ) : null}
                  </button>
                </form>
              </li>
            );
          })}
          <li>
            <Link
              href="/business/new"
              onClick={() => setOpen(false)}
              className="gap-base py-md hover:bg-surface-soft flex w-full items-center text-left"
            >
              <span className="bg-surface-strong text-muted grid size-11 shrink-0 place-items-center rounded-sm">
                <Icons.add style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-title text-ink block font-medium">Add a salon</span>
                <span className="text-caption-sm text-muted block">
                  A second shop, on its own plan
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}

function planLabel(plan: Business["plan"]): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
