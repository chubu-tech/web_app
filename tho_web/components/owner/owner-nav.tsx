"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSize } from "@/components/ui/icons";
import { isCurrent } from "@/lib/nav";
import type { Business } from "@/lib/types/salon";
import { cn } from "@/lib/utils";
import { readyOwnerTabs } from "./destinations";
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
 * A separate component from the customer nav rather than one parameterised by a list. The
 * two differ in the header (a switcher, not a wordmark), in what they badge (nothing here
 * until 3c lands Messages) and in the chrome around them; unifying them would mean a
 * component that is mostly conditionals. What they genuinely share — how a path maps to a
 * destination — is `lib/nav.ts`, and that *is* shared.
 */

export function OwnerHeader({
  active,
  businesses,
}: {
  active: Business | null;
  businesses: Business[];
}) {
  const pathname = usePathname();
  const tabs = readyOwnerTabs();

  return (
    <header className="border-hairline bg-canvas sticky top-0 z-30 border-b">
      <div className="px-base tablet:px-lg gap-base mx-auto flex h-16 max-w-[1440px] items-center">
        <SalonSwitcher active={active} businesses={businesses} />

        {/* Scrolls inside itself, never the body — the same rule the customer top nav
            follows. Five tabs with labels will not fit at exactly 744 once 3c turns
            Insights and Messages on. */}
        <nav aria-label="Owner" className="hidden min-w-0 flex-1 tablet:block">
          <ul className="gap-xs flex items-center justify-end overflow-x-auto">
            {tabs.map((d) => {
              const current = isCurrent(d, pathname);
              const Icon = d.icon;
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
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function OwnerTabBar() {
  const pathname = usePathname();
  const tabs = readyOwnerTabs();

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
          return (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={current ? "page" : undefined}
                className="gap-xs flex h-full flex-col items-center justify-center"
              >
                <Icon
                  style={{ width: IconSize.md, height: IconSize.md }}
                  strokeWidth={current ? 2.2 : 1.8}
                  className={cn(
                    "transition-transform duration-[--duration-slow]",
                    current ? "text-rausch scale-105" : "text-muted",
                  )}
                  aria-hidden
                />
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
