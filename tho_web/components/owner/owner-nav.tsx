"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppHeader } from "@/components/ui/app-header";
import { BrandLockup } from "@/components/ui/brand-lockup";
import {
  CollapseNavButton,
  CollapseNavPanel,
  CollapseNavRow,
  useCollapseNav,
} from "@/components/ui/collapse-nav";
import { Icons, IconSize } from "@/components/ui/icons";
import { NavLink } from "@/components/ui/nav-link";
import { isCurrent } from "@/lib/nav";
import type { Business } from "@/lib/types/salon";
import { readyOwnerTabs } from "./destinations";

/**
 * The owner console's navigation â€” the mirror of `components/customer/customer-nav.tsx`,
 * and a port of `business_home.dart`'s `AppBar` + `AppNavBar`.
 *
 * **The header never hides**, and at 1024 it collapses rather than dropping anything.
 *
 * ## The wordmark is here and the salon switcher is not
 *
 * This header used to open with the switcher â€” salon name over `Owner Â· Growth plan`, with a
 * chevron â€” where every other nav in the product opens with the logo. Two things were wrong
 * with that, and they compound:
 *
 * - **A dropdown is not chrome.** Which salon the console is showing is *page context*: it
 *   changes what every figure on the screen means. Parking it in the bar put a control that
 *   reloads the entire console beside five plain links, at the size and weight of a title.
 * - **The console was the one shell with no logo.** A customer arriving from
 *   bhutansalons.com meets the same lockup on the marketing site and on Discover; an owner
 *   met a salon name and no indication of whose software this is.
 *
 * So the wordmark takes the slot (`BrandLockup`, the same component the customer header and
 * the 404 render) and the switcher gets a row of its own directly beneath, in
 * `app/business/layout.tsx`. It scrolls away with the page, which is right for context and
 * wrong for chrome, and it is no longer competing with the destinations for width â€” which is
 * what pushed this header's collapse out to 1024 in the first place.
 *
 * The logo points at `/business`, not `/`: `/` only redirects an owner back here.
 *
 * ## One row, and one collapse, at 1024
 *
 * - **â‰¥1024** all five destinations inline, and **no hamburger at all** â€” not hidden, not
 *   disabled, not rendered. The panel it opens is not rendered either.
 * - **<1024** the destinations come out of the header entirely and the hamburger appears in
 *   its place, on the right, opening the same five as a menu.
 *
 * This replaced a second header row: a 44px horizontally-scrollable strip that carried all
 * five below 744, on the reasoning that an owner works one-handed at a till and a tap plus an
 * overlay is the wrong toll for the things they touch all day. That reasoning was sound and
 * the strip is still gone, because it only ever covered *below 744* â€” between 744 and 1024
 * the tabs were inline and cramped against the switcher, which is the range this now fixes.
 * If the toll turns out to matter, the strip is the thing to bring back, at this breakpoint
 * rather than the old one.
 *
 * **1024 is not one of DESIGN.md's four tiers**, and it is a real addition rather than a
 * rounding of `tablet`: five labelled tabs plus a nine-salon switcher plus a bell did not fit
 * at 744, so the tier that suits the customer's five left this header overflowing. See
 * `--breakpoint-console` in `globals.css`, which is where the number lives. The switcher has
 * since moved out from under the bar, which reclaimed up to 320px â€” so this tier is now wider
 * than it strictly has to be. **Left at 1024 deliberately**: it is the same number
 * `CollapseNavPanel`'s `closeAbove` is given below, and moving it means moving both together
 * or shipping a menu that covers a nav it cannot close. Re-measure before touching it.
 *
 * **The panel is now the navigation, not just the account.** It used to hold sign-out alone,
 * because the destinations were always on screen somewhere. They are not any more below 1024,
 * so the five lead and the account follows in the footer. Above 1024 there is no panel, which
 * is why **`/business/settings` now carries its own sign-out**: without it a desktop owner
 * would have no way out again, which is the exact defect the panel was added to fix.
 *
 * A separate component from the customer nav rather than one parameterised by a list. The
 * two differ in what they badge, in where they collapse, and in having no "Sign in" call to
 * action; unifying them would mean a component that is mostly conditionals. What they
 * genuinely share is now four things, not two â€” `lib/nav.ts`, `components/ui/collapse-nav.tsx`,
 * `NavLink` and, since the switcher moved out of the bar, `BrandLockup`.
 */

/**
 * `--breakpoint-console` again, because `matchMedia` takes a number and cannot read a CSS
 * custom property. The panel closes itself at exactly the width the hamburger stops being
 * rendered at; if these two ever disagree, the failure is an open menu covering a nav that is
 * already visible, with nothing on screen to close it.
 */
const CONSOLE_NAV = 1024;
export function OwnerHeader({
  active,
  unreadNotifications = 0,
  unreadMessages = 0,
}: {
  /**
   * Only for the panel's closing line. The roster it used to need went with the switcher
   * â€” `SalonSwitcher` is rendered by the layout now, so this header no longer takes
   * `businesses` and no longer re-renders when a salon is added.
   */
  active: Business | null;
  unreadNotifications?: number;
  unreadMessages?: number;
}) {
  const pathname = usePathname();
  const tabs = readyOwnerTabs();
  const nav = useCollapseNav();

  const badgeFor = (href: string) =>
    href === "/business/messages" ? unreadMessages : 0;

  return (
    <>
      <AppHeader
        label="Owner"
        navFrom="console"
        left={<BrandLockup href="/business" label="Tho for salons â€” console" priority />}
        nav={
          /* Still scrolls inside itself, never the body — the same rule the customer header
             follows. It matters less now that the row only exists from 1024 and the switcher
             has left the bar, but the guard costs nothing and the alternative failure is the
             *body* scrolling sideways. The scroll moved up to the nav region in `AppHeader`;
             see the note on `COLLAPSE` for why it has to be there and not here.

             Centred, like the marketing site's, not pinned right. `justify-end` left 439px of
             dead canvas on the left while the five tabs crowded the bell — measured at 1920.
             `w-max mx-auto` centres while it fits and collapses to a normal scroll when it
             does not. */
          <ul className="gap-xs mx-auto flex w-max items-center">
            {tabs.map((d) => {
              const current = isCurrent(d, pathname);
              const badge = badgeFor(d.href);
              return (
                <li key={d.href} className="shrink-0">
                  {/* The same `NavLink` the customer header uses. This was a copy of that
                      header's class string; the two are one component now, so the
                      marketing site's underline treatment reaches both shells at once. */}
                  <NavLink href={d.href} label={d.label} icon={d.icon} current={current}>
                    {badge > 0 ? <Badge count={badge} /> : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        }
        right={
          <>
            <Link
              href="/business/notifications"
              aria-label={
                unreadNotifications > 0
                  ? `Notifications, ${unreadNotifications} unread`
                  : "Notifications"
              }
              className="text-muted hover:text-ink hover:bg-surface-soft relative grid size-11 place-items-center rounded-full"
            >
              {unreadNotifications > 0 ? (
                <>
                  <Icons.notificationActive
                    className="text-ink"
                    style={{ width: IconSize.sm, height: IconSize.sm }}
                    aria-hidden
                  />
                  <span className="bg-rausch text-on-primary text-badge absolute top-1 right-0 grid min-w-4 place-items-center rounded-full px-[4px] font-semibold">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                </>
              ) : (
                <Icons.notification
                  style={{ width: IconSize.sm, height: IconSize.sm }}
                  aria-hidden
                />
              )}
            </Link>

            {/*
              Below 1024 only. `console:hidden` rather than a `matchMedia` in JavaScript: a
              media query hook has no answer during the server render, so it would ship a
              header that either flashes a hamburger on desktop or has none on a phone until
              hydration. `display: none` is not a weaker "do not render" than that â€” it takes
              the button out of the accessibility tree and out of the tab order, which is
              every way a user can reach it.
            */}
            <CollapseNavButton nav={nav} label="Menu" className="console:hidden" />
          </>
        }
      />

      {/*
        The five destinations, and then the way out.

        Until this panel existed the console had **no sign-out anywhere** â€” not in the header,
        not in the salon switcher, not in the settings hub â€” so an owner's only way out was to
        know that the customer `/profile` route existed and type it. It is no longer the only
        one: above 1024 this whole panel is closed and unreachable, so `/business/settings`
        carries the same action. Two surfaces, one route handler. See
        `app/auth/sign-out/route.ts`.
      */}
      <CollapseNavPanel
        {...nav.panelProps}
        title="Menu"
        closeAbove={CONSOLE_NAV}
        footer={<SignOutButton variant="outlined" fullWidth />}
      >
        <nav aria-label="Owner sections">
          <ul>
            {tabs.map((d, i) => {
              const current = isCurrent(d, pathname);
              const Icon = d.icon;
              const badge = badgeFor(d.href);
              return (
                <CollapseNavRow key={d.href} index={i} current={current}>
                  <Link
                    href={d.href}
                    onClick={nav.close}
                    aria-current={current ? "page" : undefined}
                    className="gap-md flex flex-1 items-center"
                  >
                    <Icon
                      style={{ width: IconSize.sm, height: IconSize.sm }}
                      strokeWidth={current ? 2.2 : 1.8}
                      aria-hidden
                    />
                    <span className="flex-1">{d.label}</span>
                    {badge > 0 ? <Badge count={badge} /> : null}
                  </Link>
                </CollapseNavRow>
              );
            })}
          </ul>
        </nav>

        <p className="text-body-sm text-muted mt-lg">
          Signed in as the owner
          {active ? ` of ${active.name}` : ""}. Signing out ends the session on this device
          and forgets which salon you were looking at.
        </p>
      </CollapseNavPanel>
    </>
  );
}

/** The unread count on the Messages tab, capped as the app's is. */
function Badge({ count }: { count: number }) {
  return (
    <span
      className="bg-rausch text-on-primary text-badge px-xs min-w-5 rounded-full text-center font-semibold tabular-nums"
      aria-label={`${count} unread`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
