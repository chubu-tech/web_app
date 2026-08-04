"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons, IconSize } from "@/components/ui/icons";
import { isCurrent } from "@/lib/nav";
import type { Business } from "@/lib/types/salon";
import { cn } from "@/lib/utils";
import { phoneOwnerTabs, readyOwnerTabs } from "./destinations";
import { SalonSwitcher } from "./salon-switcher";

/**
 * The owner console's navigation — the mirror of `components/customer/customer-nav.tsx`,
 * and a port of `business_home.dart`'s `AppBar` + `AppNavBar`.
 *
 * The responsive rule is the customer shell's, from `../tho/DESIGN.md:518-537` — *always
 * reduce columns, never reflow rows*: below 744 a bottom tab bar as the app has, at 744
 * and up the tabs move into the header. Selection is colour plus stroke weight, because
 * the stroke icon set has no filled variant to swap in.
 *
 * **The header never hides.** The customer's is `hidden tablet:block`, but this one holds
 * the salon switcher, and the seeded owner runs nine salons — switching has to work on a
 * phone at the till, not only on a desktop.
 *
 * ## The phone bar carries four of the five tabs
 *
 * The app's `AppNavBar` has five: Insights · Calendar · Queue · Messages · Settings. Five
 * fixed items at 390px leaves each 78px wide, which is under the 44px touch target once the
 * label is centred under the glyph and is the width at which "Calendar" starts truncating.
 * So **Settings comes out of the bar and into the header**, as a gear beside the bell — it is
 * the one destination you go to deliberately rather than react to, and 3b's hub already
 * gathers everything inside it. The desktop header keeps all five, where there is room.
 *
 * A separate component from the customer nav rather than one parameterised by a list. The
 * two differ in the header (a switcher and a bell, not a wordmark), in what they badge, and
 * in the chrome around them; unifying them would mean a component that is mostly
 * conditionals. What they genuinely share — how a path maps to a destination — is
 * `lib/nav.ts`, and that *is* shared.
 */

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

  return (
    <header className="border-hairline bg-canvas sticky top-0 z-30 border-b">
      <div className="px-base tablet:px-lg gap-base mx-auto flex h-16 max-w-[1440px] items-center">
        <SalonSwitcher active={active} businesses={businesses} />

        {/* Scrolls inside itself, never the body — the same rule the customer top nav
            follows. Five tabs with labels do not fit at exactly 744. */}
        <nav aria-label="Owner" className="hidden min-w-0 flex-1 tablet:block">
          <ul className="gap-xs flex items-center justify-end overflow-x-auto">
            {tabs.map((d) => {
              const current = isCurrent(d, pathname);
              const Icon = d.icon;
              const badge = d.href === "/business/messages" ? unreadMessages : 0;
              return (
                <li key={d.href} className="shrink-0">
                  <Link
                    href={d.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "text-title px-md gap-sm flex min-h-12 items-center rounded-full font-medium",
                      current ? "text-rausch-cta bg-rausch/10" : "text-muted hover:text-ink",
                    )}
                  >
                    <Icon
                      style={{ width: IconSize.sm, height: IconSize.sm }}
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
        </nav>

        <div className="gap-xs ml-auto flex shrink-0 items-center tablet:ml-0">
          {/* Settings lives here on a phone, where the bar has no room for a fifth item. */}
          <Link
            href="/business/settings"
            aria-label="Settings"
            className="text-muted hover:text-ink hover:bg-surface-soft grid size-11 place-items-center rounded-full tablet:hidden"
          >
            <Icons.settings
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          </Link>

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
        </div>
      </div>
    </header>
  );
}

export function OwnerTabBar({ unreadMessages = 0 }: { unreadMessages?: number }) {
  const pathname = usePathname();
  const tabs = phoneOwnerTabs();

  return (
    <nav
      aria-label="Owner"
      className={cn(
        "border-hairline bg-canvas fixed inset-x-0 bottom-0 z-30 border-t tablet:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex h-[62px] items-stretch">
        {tabs.map((d) => {
          const current = isCurrent(d, pathname);
          const Icon = d.icon;
          const badge = d.href === "/business/messages" ? unreadMessages : 0;
          return (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={current ? "page" : undefined}
                className="gap-xs flex h-full flex-col items-center justify-center"
              >
                <span className="relative">
                  <Icon
                    style={{ width: IconSize.md, height: IconSize.md }}
                    strokeWidth={current ? 2.2 : 1.8}
                    className={cn(
                      "transition-transform duration-[--duration-slow]",
                      current ? "text-rausch scale-105" : "text-muted",
                    )}
                    aria-hidden
                  />
                  {badge > 0 ? (
                    <span className="bg-rausch text-on-primary text-badge absolute -top-1 -right-2 grid min-w-4 place-items-center rounded-full px-[4px] font-semibold">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-badge",
                    current ? "text-ink font-semibold" : "text-muted font-medium",
                  )}
                >
                  {d.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="bg-rausch text-on-primary text-badge grid min-w-4 place-items-center rounded-full px-[5px] font-semibold">
      {count > 9 ? "9+" : count}
    </span>
  );
}
