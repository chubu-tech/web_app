"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppHeader } from "@/components/ui/app-header";
import { IconSize } from "@/components/ui/icons";
import { isCurrent } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { STAFF_TABS, type StaffDestination } from "./destinations";

/**
 * The staff shell's navigation â€” a port of the `AppBar` + `AppNavBar` pair in
 * `staff/staff_home.dart:52-74`.
 *
 * **No hamburger, at any width.** The other two shells collapse because they carry five
 * destinations plus a switcher or a wordmark; this carries two, which fit beside a name and
 * a sign-out on a 390px phone. Hence `navFrom="always"` â€” see the note beside `COLLAPSE` in
 * `app-header.tsx`. A collapse panel here would hide two links behind a tap for no reason,
 * and would then be the only way to sign out, which is the defect the owner panel exists to
 * fix rather than one to reproduce.
 *
 * **The left slot is the stylist's own name**, where the console puts a salon switcher and
 * the customer shell puts the wordmark. That is the app's title (`me?.displayName`), and it
 * is the right thing for a shell whose whole subject is one person: a stylist working at one
 * salon has nothing to switch between.
 *
 * **No notification bell**, unlike the app's AppBar. `notifications.recipient_profile_id` is
 * the only routing there is and `private.enqueue_order_notification` addresses a salon's
 * copies to `business_owner_profile(...)` â€” so, measured, **a linked stylist receives none
 * of the salon's notifications**. The app's bell over an empty feed promises a channel that
 * does not reach them. Sign-out is here instead, which is what they actually need.
 */
export function StaffHeader({ displayName }: { displayName: string | null }) {
  const pathname = usePathname();

  return (
    <AppHeader
      label="Staff"
      navFrom="always"
      left={
        <span className="text-title text-ink min-w-0 shrink truncate font-semibold">
          {/* The app falls back to "My salon" when the staff row has not loaded; here the
              row is resolved server-side before this renders, so the only null case is an
              account no owner has linked yet â€” and that shell has no tabs to label. */}
          {displayName ?? "My salon"}
        </span>
      }
      nav={
        <ul className="gap-xs flex items-center justify-end">
          {STAFF_TABS.map((d) => (
            <li key={d.href} className="shrink-0">
              <TabLink destination={d} current={isCurrent(d, pathname)} />
            </li>
          ))}
        </ul>
      }
      right={<SignOutButton variant="outlined" />}
    />
  );
}

/** One destination. Same treatment as the console's tabs: a tinted pill when current. */
function TabLink({
  destination,
  current,
}: {
  destination: StaffDestination;
  current: boolean;
}) {
  const Icon = destination.icon;

  return (
    <Link
      href={destination.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "gap-xs px-md text-title flex min-h-11 items-center rounded-full font-medium",
        "transition-colors duration-[--duration-fast]",
        current
          ? "bg-rausch/10 text-rausch-cta"
          : "text-body hover:bg-surface-soft hover:text-ink",
      )}
    >
      <Icon style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
      {destination.label}
    </Link>
  );
}
