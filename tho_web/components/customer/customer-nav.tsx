"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSize } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { isCurrent, readySecondary, readyTabs, type Destination } from "./destinations";

/**
 * The customer shell's navigation, ported from
 * `tho/app/lib/ui/widgets/app_nav_bar.dart` and the app's drawer.
 *
 * Responsive per `../tho/DESIGN.md:518-537` — *always reduce columns, never reflow
 * rows*:
 *
 * - **<744** a bottom tab bar, as the app: a 24px glyph over an 11px label, the
 *   active tab in rausch at a heavier stroke. 24-over-11 is the platform ratio; the
 *   app shipped 28 once and records that it inverted the pairing.
 * - **≥744** the tabs move to a top nav and the drawer items join them. A bottom tab
 *   bar on a 1400px screen is a phone artefact, not a design.
 *
 * Selection is carried by colour and stroke weight, matching the app — the free
 * stroke icon sets have no filled variant to swap in.
 */

export function CustomerTopNav() {
  const pathname = usePathname();
  const items = [...readyTabs(), ...readySecondary()];

  return (
    <header className="border-hairline bg-canvas sticky top-0 z-30 hidden border-b tablet:block">
      <nav
        aria-label="Main"
        className="px-lg gap-lg mx-auto flex h-16 max-w-[1440px] items-center"
      >
        <Link href="/" className="text-display-md text-rausch-cta font-bold">
          Tho
        </Link>
        <ul className="gap-xs flex flex-1 items-center">
          {items.map((d) => (
            <li key={d.href}>
              <TopLink destination={d} current={isCurrent(d.href, pathname)} />
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function TopLink({
  destination: d,
  current,
}: {
  destination: Destination;
  current: boolean;
}) {
  const Icon = d.icon;
  return (
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
  );
}

export function CustomerTabBar() {
  const pathname = usePathname();
  const items = [...readyTabs(), ...readySecondary()];

  return (
    <nav
      aria-label="Main"
      className={cn(
        "border-hairline bg-canvas fixed inset-x-0 bottom-0 z-30 border-t tablet:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex h-[62px] items-stretch">
        {items.map((d) => {
          const current = isCurrent(d.href, pathname);
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
