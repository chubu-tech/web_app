"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSize } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  isCurrent,
  readySecondary,
  readyTabs,
  secondaryHasUnread,
  type Destination,
} from "./destinations";
import { useInboxCounts } from "./use-inbox-counts";

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
 * **The bar carries `TABS` only** — the five the app has. `SECONDARY` joins the top nav
 * above 744 and lives on `/profile` below it. It used to be in both, which was fine at
 * four items and stopped being fine the moment Chats and Notifications landed; nine
 * destinations do not fit on a 390px bar at a usable tap size. The Profile tab carries a
 * dot instead, so nothing arrives unannounced.
 *
 * Selection is carried by colour and stroke weight, matching the app — the free
 * stroke icon sets have no filled variant to swap in.
 */

export function CustomerTopNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const counts = useInboxCounts(signedIn);
  const items = [...readyTabs(), ...readySecondary()];

  return (
    <header className="border-hairline bg-canvas sticky top-0 z-30 hidden border-b tablet:block">
      <nav
        aria-label="Main"
        className="px-lg gap-lg mx-auto flex h-16 max-w-[1440px] items-center"
      >
        <Link href="/" className="text-display-md text-rausch-cta shrink-0 font-bold">
          Tho
        </Link>
        {/* **Scrolls inside itself.** Six destinations with labels are wider than 744, so
            without this the whole page scrolled sideways at exactly the tablet breakpoint —
            which is what adding Chats and Notifications did. Overflow belongs to the strip
            that has too much in it, never to the body; the same rule the salon page's
            action row and the inbox filter chips already follow. */}
        <ul className="gap-xs flex min-w-0 flex-1 items-center overflow-x-auto">
          {items.map((d) => (
            <li key={d.href} className="shrink-0">
              <TopLink
                destination={d}
                current={isCurrent(d, pathname)}
                count={d.badge ? counts[d.badge] : 0}
              />
            </li>
          ))}
        </ul>
        {/* Signing in is the one thing a returning customer most often needs and
            the tab bar has no room to say. Shown only when it applies — a guest
            counts as not signed in, because they have a session but no account. */}
        {signedIn ? null : (
          <Link
            href={`/sign-in?next=${encodeURIComponent(pathname)}`}
            className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed flex min-h-12 shrink-0 items-center rounded-sm px-4 font-medium"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

function TopLink({
  destination: d,
  current,
  count,
}: {
  destination: Destination;
  current: boolean;
  count: number;
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
      {count > 0 ? <CountBadge count={count} label={d.label} /> : null}
    </Link>
  );
}

/**
 * The unread number, capped at "9+" as the app's bell is.
 *
 * The count is in the accessible name rather than left as a bare glyph, so a screen reader
 * hears "Chats, 2 unread" instead of a number floating beside a link.
 */
function CountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span
      className="bg-rausch text-on-primary text-badge px-xs min-w-5 rounded-full text-center font-semibold tabular-nums"
      aria-label={`${count} unread ${label.toLowerCase()}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function CustomerTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const counts = useInboxCounts(signedIn);
  // `TABS` only. The secondary items are rows on /profile below 744 — see the file note.
  const items = readyTabs();
  const profileDot = secondaryHasUnread(counts);

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
          const current = isCurrent(d, pathname);
          const Icon = d.icon;
          const count = d.badge ? counts[d.badge] : 0;
          // Profile is the way to everything in `SECONDARY` on a phone, so it inherits
          // their unread state as a plain dot — a number would imply it was Profile's own.
          const dot = d.href === "/profile" && profileDot;
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
                  {count > 0 ? (
                    <span
                      className="bg-rausch text-on-primary text-badge px-1 absolute -top-1 -right-2 min-w-4 rounded-full text-center font-semibold tabular-nums"
                      aria-label={`${count} unread`}
                    >
                      {count > 9 ? "9+" : count}
                    </span>
                  ) : dot ? (
                    <span
                      className="bg-rausch absolute -top-0.5 -right-1 size-2 rounded-full"
                      aria-label="Something new"
                    />
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
