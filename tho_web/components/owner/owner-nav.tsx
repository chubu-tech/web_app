"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppHeader } from "@/components/ui/app-header";
import {
  CollapseNavButton,
  CollapseNavPanel,
  CollapseNavRow,
  useCollapseNav,
} from "@/components/ui/collapse-nav";
import { Icons, IconSize } from "@/components/ui/icons";
import { isCurrent } from "@/lib/nav";
import type { Business } from "@/lib/types/salon";
import { cn } from "@/lib/utils";
import { readyOwnerTabs } from "./destinations";
import { SalonSwitcher } from "./salon-switcher";

/**
 * The owner console's navigation — the mirror of `components/customer/customer-nav.tsx`,
 * and a port of `business_home.dart`'s `AppBar` + `AppNavBar`.
 *
 * **The header never hides.** The customer's used to be `hidden tablet:block`, but this one
 * holds the salon switcher, and the seeded owner runs nine salons — switching has to work on
 * a phone at the till, not only on a desktop.
 *
 * ## One row, and one collapse, at 1024
 *
 * - **≥1024** all five destinations inline, and **no hamburger at all** — not hidden, not
 *   disabled, not rendered. The panel it opens is not rendered either.
 * - **<1024** the destinations come out of the header entirely and the hamburger appears in
 *   its place, on the right, opening the same five as a menu.
 *
 * This replaced a second header row: a 44px horizontally-scrollable strip that carried all
 * five below 744, on the reasoning that an owner works one-handed at a till and a tap plus an
 * overlay is the wrong toll for the things they touch all day. That reasoning was sound and
 * the strip is still gone, because it only ever covered *below 744* — between 744 and 1024
 * the tabs were inline and cramped against the switcher, which is the range this now fixes.
 * If the toll turns out to matter, the strip is the thing to bring back, at this breakpoint
 * rather than the old one.
 *
 * **1024 is not one of DESIGN.md's four tiers**, and it is a real addition rather than a
 * rounding of `tablet`: five labelled tabs plus a nine-salon switcher plus a bell do not fit
 * at 744, so the tier that suits the customer's five leaves this header overflowing. See
 * `--breakpoint-console` in `globals.css`, which is where the number lives.
 *
 * **The panel is now the navigation, not just the account.** It used to hold sign-out alone,
 * because the destinations were always on screen somewhere. They are not any more below 1024,
 * so the five lead and the account follows in the footer. Above 1024 there is no panel, which
 * is why **`/business/settings` now carries its own sign-out**: without it a desktop owner
 * would have no way out again, which is the exact defect the panel was added to fix.
 *
 * A separate component from the customer nav rather than one parameterised by a list. The
 * two differ in the header (a switcher, not a wordmark), in what they badge, in where they
 * collapse, and in having no "Sign in" call to action; unifying them would mean a component
 * that is mostly conditionals. What they genuinely share — how a path maps to a destination,
 * and the overlay behaviour — is `lib/nav.ts` and `components/ui/collapse-nav.tsx`.
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
  businesses,
  unreadNotifications = 0,
  unreadMessages = 0,
}: {
  active: Business | null;
  businesses: Business[];
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
        tone="console"
        navFrom="console"
        left={<SalonSwitcher active={active} businesses={businesses} />}
        nav={
          /* Still scrolls inside itself, never the body — the same rule the customer header
             follows. It matters less now that the row only exists from 1024, but a nine-salon
             switcher can take 320px of that and the guard costs nothing. */
          <ul className="gap-xs flex items-center justify-end overflow-x-auto">
            {tabs.map((d) => {
              const current = isCurrent(d, pathname);
              const Icon = d.icon;
              const badge = badgeFor(d.href);
              return (
                <li key={d.href} className="shrink-0">
                  <Link
                    href={d.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "text-title px-md gap-sm flex min-h-11 items-center rounded-full font-medium",
                      current ? "text-rausch-cta bg-rausch/10" : "text-muted hover:text-ink",
                    )}
                  >
                    <Icon
                      style={{ width: IconSize.xs, height: IconSize.xs }}
                      strokeWidth={current ? 2.2 : 1.8}
                      aria-hidden
                    />
                    {d.label}
                    {badge > 0 ? <Badge count={badge} /> : null}
                  </Link>
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
              hydration. `display: none` is not a weaker "do not render" than that — it takes
              the button out of the accessibility tree and out of the tab order, which is
              every way a user can reach it.
            */}
            <CollapseNavButton nav={nav} label="Menu" className="console:hidden" />
          </>
        }
      />

      {/*
        The five destinations, and then the way out.

        Until this panel existed the console had **no sign-out anywhere** — not in the header,
        not in the salon switcher, not in the settings hub — so an owner's only way out was to
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
