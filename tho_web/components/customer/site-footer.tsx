"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { Icons, IconSize } from "@/components/ui/icons";
import { readySecondary, readyTabs } from "./destinations";

/**
 * The customer shell's footer.
 *
 * ## Every link here is a route that exists
 *
 * The groups below are built from `destinations.ts`, the same list the header and
 * `/profile` read, rather than from a hand-written array — so the footer cannot promise
 * a page the nav knows is not ready, and a milestone that flips a `ready` flag lights it
 * up in all three places at once. That rule is why there is no About, no Help centre, no
 * Privacy and no app-store badge: none of them exist, and a footer full of dead links is
 * the most generic thing a footer can be.
 *
 * `/products` and `/cart` are deliberately absent for the same reason `destinations.ts`
 * gives — Products is a *segment* of Discover sharing its search box, and the cart is
 * contextual chrome that is usually empty.
 *
 * ## It hides itself on the four routes that own their viewport
 *
 * A footer is the bottom of a *document*. Four customer routes are not documents:
 *
 * - **`/map`** sizes a leaflet container to `100svh` minus the header, so anything below
 *   it invents a scrollbar on a page designed to have none.
 * - **`/messages/[id]`** is a thread with a sticky composer pinned to the bottom edge;
 *   a footer under it puts site navigation between the composer and the page end.
 * - **`/salon/[id]/book`** is the booking wizard, which carries its own fixed summary
 *   bar below `desktop` — two stacked bars, one of them irrelevant mid-booking.
 * - **`/cart`** ends in a total and a Place-order button, which is the one thing that
 *   should be last on that page.
 *
 * Same mechanism `CartBar` uses for the same class of reason, and the reason it is a
 * client component at all.
 *
 * ## What makes it this product's footer rather than a template
 *
 * The bottom line states the two facts that actually govern every number and time on
 * this site — **Nu**, and **Bhutan time, UTC+6 with no DST** — which is a real hazard
 * for a browser that can be anywhere and is the thing `lib/time.ts` exists to hold. It
 * is not "all rights reserved".
 */
export function SiteFooter({
  signedIn,
  year,
}: {
  signedIn: boolean;
  /**
   * Resolved on the server and passed in.
   *
   * `new Date().getFullYear()` inside this client component would be evaluated twice —
   * once during the server render and once at hydration — and React would flag the
   * mismatch on the one night of the year they disagree. One value, rendered once.
   */
  year: number;
}) {
  const pathname = usePathname();

  const ownsViewport =
    pathname === "/map" ||
    pathname === "/cart" ||
    // The thread, not the list: `/messages` is an ordinary page.
    /^\/messages\/[^/]+$/.test(pathname) ||
    /^\/salon\/[^/]+\/book$/.test(pathname);
  if (ownsViewport) return null;

  const tabs = readyTabs();
  const secondary = readySecondary();
  const at = (href: string) => [...tabs, ...secondary].find((d) => d.href === href);

  // Three groups, each answering a different question, and each built from the live
  // destination list so a label can never drift from the header's.
  const groups: { label: string; items: { href: string; label: string }[] }[] = [
    { label: "Browse", items: pick(["/", "/map", "/saved"], at) },
    { label: "Your visits", items: pick(["/bookings", "/messages", "/notifications"], at) },
    { label: "Shop & rewards", items: pick(["/orders", "/rewards", "/profile"], at) },
  ];

  return (
    <footer className="bg-surface-soft border-hairline-soft mt-xxl border-t">
      <div className="px-base tablet:px-lg py-xxl mx-auto w-full max-w-[1128px]">
        {/*
          Asymmetric on purpose. Four equal columns is the shape every template ships;
          giving the brand block half again as much room makes the three link columns
          read as a group beside it rather than as a fourth peer.
        */}
        <div className="gap-xl desktop:gap-section grid desktop:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <BrandLockup />
            <p className="text-body-md text-body mt-base max-w-[34ch]">
              Book a chair, hold your place in a walk-in line, and pick up what your salon
              actually uses — across Bhutan.
            </p>

            {signedIn ? null : (
              <Link
                href="/sign-in"
                className="bg-ink text-on-primary text-title hover:bg-obsidian-soft gap-sm px-lg mt-lg inline-flex min-h-12 items-center rounded-full font-medium transition-colors duration-[var(--duration-fast)]"
              >
                Sign in
                <Icons.forward
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
              </Link>
            )}
          </div>

          {/*
            **Two columns at 390**, not one. Nine links in a single stack made the footer
            955px tall on a phone — measured — which is a screen and a half of scrolling
            past the end of the page. The labels are one or two short words, so two
            columns fit at 171px each and the block halves. Three columns only at
            `desktop`, where the brand block sits beside them.

            A `nav` per group with its own label, because three unlabelled link lists in
            one landmark is one landmark a screen reader cannot navigate.
          */}
          <div className="gap-lg desktop:gap-lg grid grid-cols-2 desktop:col-span-3 desktop:grid-cols-3">
            {groups.map((group) => (
              <nav key={group.label} aria-label={group.label}>
                <h2 className="text-caption-sm text-ink mb-md font-semibold tracking-[0.14em] uppercase">
                  {group.label}
                </h2>
                <ul className="flex flex-col">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        // `min-h-11` rather than padding alone: these are the smallest
                        // targets on the page and a footer is where a thumb is least
                        // accurate. The negative inline margin keeps the text optically
                        // aligned with the heading despite the padded hit area.
                        className="text-body-md text-body hover:text-ink focus-visible:outline-ink -mx-sm px-sm inline-flex min-h-11 items-center rounded-sm transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-0"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/*
          The two facts that govern every figure above them. `pb` carries the safe-area
          inset and enough room to clear `CartBar`, which floats ~56px off the bottom edge
          when there is something in the cart and would otherwise sit on this line.
        */}
        {/*
          `text-body` (#3f3f3f), **not** `text-muted`. Measured on this band: muted is
          4.48:1 against `surface-soft` in the customer shell, which fails AA by 0.02 —
          the token is written for the white console, where the same colour clears it
          comfortably. `text-body` is 8.5:1 here. A muted grey that only passes on one of
          the two canvases is the kind of thing no linter catches.
        */}
        <div className="border-hairline-soft mt-xxl pt-lg gap-sm text-caption text-body flex flex-col pb-[calc(var(--spacing-xl)+env(safe-area-inset-bottom))] tablet:flex-row tablet:items-center border-t">
          <p className="flex-1">© {year} THO</p>
          <p>Prices in Nu · Times shown in Bhutan time (UTC+6)</p>
        </div>
      </div>
    </footer>
  );
}

/** Resolve hrefs against the live destination list, dropping anything not ready. */
function pick(
  hrefs: string[],
  at: (href: string) => { href: string; label: string } | undefined,
): { href: string; label: string }[] {
  return hrefs
    .map((href) => at(href))
    .filter((d): d is { href: string; label: string } => d != null)
    .map((d) => ({ href: d.href, label: d.label }));
}
