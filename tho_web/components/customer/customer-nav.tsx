"use client";

import Image from "next/image";
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
import { cn } from "@/lib/utils";
import {
  hiddenUnread,
  isCurrent,
  readySecondary,
  readyTabs,
  type Destination,
} from "./destinations";
import { useInboxCounts } from "./use-inbox-counts";

/**
 * The customer shell's navigation.
 *
 * **One header at every width; no bottom tab bar.** This used to be two components — a top
 * nav from 744 up and a fixed bottom tab bar below it, ported from
 * `tho/app/lib/ui/widgets/app_nav_bar.dart`. The bar is gone: a thumb-reachable strip glued
 * to the bottom of the viewport is a phone-app idiom, and on a desktop browser it was the
 * clearest tell that this was a port rather than a website.
 *
 * Responsive per `../tho/DESIGN.md:518-537` — *always reduce columns, never reflow rows*:
 *
 * - **<744** wordmark · bell · menu. The menu holds all nine destinations in two groups.
 * - **744–1127** the five `TABS` come inline; the menu keeps `SECONDARY`.
 * - **≥1128** `SECONDARY` joins the header as icon buttons and the menu disappears.
 *
 * ## Two things collapsing the two components fixed for free
 *
 * **One poll instead of two.** `CustomerTopNav` and `CustomerTabBar` each called
 * `useInboxCounts`, so every customer page ran two independent 30-second polls issuing the
 * same pair of reads. One header, one poll.
 *
 * **A real bell instead of a proxy dot.** The old bar had five fixed slots and no room for
 * one, so the Profile tab wore a dot standing in for anything unread beneath it. The bell
 * is now on screen at every width with its own count, and the menu's dot means only the one
 * thing the header cannot show — see `hiddenUnread`.
 *
 * Selection is carried by colour and stroke weight, matching the app: the free stroke icon
 * sets have no filled variant to swap in.
 */
export function CustomerHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const counts = useInboxCounts(signedIn);
  const nav = useCollapseNav();

  const tabs = readyTabs();
  const secondary = readySecondary();
  const notifications = secondary.find((d) => d.href === "/notifications");
  // Everything the menu offers that is not already a header affordance at some width.
  const inMenu = secondary.filter((d) => d.href !== "/notifications");

  return (
    <>
      <AppHeader
        label="Main"
        tone="editorial"
        left={
          /*
            The mark plus the wordmark, matching the marketing site's lockup — a visitor
            arriving from bhutansalons.com should meet the same logo, which is the whole point
            of the shared editorial layer.

            `alt=""` because the wordmark beside it is the accessible name, and the link already
            carries `aria-label`. Two copies of "Tho" to a screen reader is worse than none.

            `rounded-md` (14px), not the editorial `slab` radius: 2rem on a 36px box is a
            circle. This tile is chrome, so it takes the product radius scale.
          */
          <Link
            href="/"
            className="gap-sm flex shrink-0 items-center"
            aria-label="Tho — home"
          >
            <Image
              src="/tho-logo.jpg"
              alt=""
              width={36}
              height={36}
              priority
              className="size-9 shrink-0 rounded-md object-cover"
            />
            <span className="text-display-md text-rausch-cta font-bold">Tho</span>
          </Link>
        }
        nav={
          /*
            Scrolls inside itself. Five destinations with labels are wider than 744, so
            without this the whole page scrolled sideways at exactly the tablet breakpoint.
            Overflow belongs to the strip that has too much in it, never to the body — the
            same rule the salon page's action row and the inbox filter chips follow.
          */
          <ul className="gap-xs flex min-w-0 items-center overflow-x-auto">
            {tabs.map((d) => (
              <li key={d.href} className="shrink-0">
                <TopLink
                  destination={d}
                  current={isCurrent(d, pathname)}
                  count={d.badge ? counts[d.badge] : 0}
                />
              </li>
            ))}
          </ul>
        }
        right={
          <>
            {notifications ? (
              <IconLink
                destination={notifications}
                current={isCurrent(notifications, pathname)}
                count={counts.notifications}
              />
            ) : null}

            {/* From 1128 the remaining destinations fit as icon buttons, so the menu has
                nothing left to hold and goes away. */}
            {inMenu.map((d) => (
              <IconLink
                key={d.href}
                destination={d}
                current={isCurrent(d, pathname)}
                count={0}
                className="hidden desktop:grid"
              />
            ))}

            {signedIn ? null : (
              <Link
                href={`/sign-in?next=${encodeURIComponent(pathname)}`}
                className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed hidden min-h-11 shrink-0 items-center rounded-full px-4 font-medium tablet:flex"
              >
                Sign in
              </Link>
            )}

            <CollapseNavButton
              nav={nav}
              dot={hiddenUnread(counts)}
              className="desktop:hidden"
            />
          </>
        }
      />

      <CollapseNavPanel
        {...nav.panelProps}
        title="Menu"
        footer={
          signedIn ? (
            /* The way out. `/profile` still has its own button, but the panel is where
               somebody looks for an account action once the nav collapsed into it. */
            <SignOutButton variant="outlined" fullWidth />
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(pathname)}`}
              onClick={nav.close}
              className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed flex min-h-12 w-full items-center justify-center rounded-sm px-4 font-medium"
            >
              Sign in
            </Link>
          )
        }
      >
        {/* The five tabs are already on screen from 744 up, so the group that duplicates
            them is hidden there rather than listed twice. */}
        <div className="tablet:hidden">
          <GroupLabel>Browse</GroupLabel>
          <ul>
            {tabs.map((d, i) => (
              <PanelRow
                key={d.href}
                destination={d}
                index={i}
                current={isCurrent(d, pathname)}
                count={d.badge ? counts[d.badge] : 0}
                onNavigate={nav.close}
              />
            ))}
          </ul>
        </div>

        <GroupLabel>You</GroupLabel>
        <ul>
          {secondary.map((d, i) => (
            <PanelRow
              key={d.href}
              destination={d}
              index={tabs.length + i}
              current={isCurrent(d, pathname)}
              count={d.badge ? counts[d.badge] : 0}
              onNavigate={nav.close}
            />
          ))}
        </ul>
      </CollapseNavPanel>
    </>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-caption-sm text-muted mt-lg mb-xs font-semibold tracking-[0.16em] uppercase">
      {children}
    </p>
  );
}

/** A large row in the collapse panel. */
function PanelRow({
  destination: d,
  index,
  current,
  count,
  onNavigate,
}: {
  destination: Destination;
  index: number;
  current: boolean;
  count: number;
  onNavigate: () => void;
}) {
  const Icon = d.icon;
  return (
    <CollapseNavRow index={index} current={current}>
      <Link
        href={d.href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className="gap-md flex flex-1 items-center"
      >
        <Icon
          style={{ width: IconSize.sm, height: IconSize.sm }}
          strokeWidth={current ? 2.2 : 1.8}
          aria-hidden
        />
        <span className="flex-1">{d.label}</span>
        {count > 0 ? <CountBadge count={count} label={d.label} /> : null}
      </Link>
    </CollapseNavRow>
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
      {count > 0 ? <CountBadge count={count} label={d.label} /> : null}
    </Link>
  );
}

/** An icon-only header affordance — the bell, and the secondary set from 1128 up. */
function IconLink({
  destination: d,
  current,
  count,
  className,
}: {
  destination: Destination;
  current: boolean;
  count: number;
  className?: string;
}) {
  const Icon = count > 0 && d.href === "/notifications" ? Icons.notificationActive : d.icon;
  return (
    <Link
      href={d.href}
      aria-current={current ? "page" : undefined}
      aria-label={count > 0 ? `${d.label}, ${count} unread` : d.label}
      className={cn(
        "hover:bg-ink/5 relative grid size-11 shrink-0 place-items-center rounded-full",
        current ? "text-rausch-cta" : "text-ink",
        className,
      )}
    >
      <Icon
        style={{ width: IconSize.sm, height: IconSize.sm }}
        strokeWidth={current ? 2.2 : 1.8}
        aria-hidden
      />
      {count > 0 ? (
        <span
          className="bg-rausch text-on-primary text-badge px-1 absolute top-1 right-0 min-w-4 rounded-full text-center font-semibold tabular-nums"
          aria-hidden
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
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
