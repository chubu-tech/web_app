import { Icons } from "@/components/ui/icons";
import type { NavMatch } from "@/lib/nav";

/**
 * The customer navigation, in one place.
 *
 * The five tabs mirror `customer_home.dart:211` — Discover · Map · Chats ·
 * Bookings · Profile — and the secondary items mirror the app's drawer
 * (`customer_home.dart:166`).
 *
 * **`ready` is the gate.** A destination only appears once its route exists, so no
 * tab ever leads somewhere unfinished. Each milestone flipped one flag as it landed:
 * Bookings with 2b, Chats and Notifications with 2d, Map with 2e, **Orders and Rewards
 * with 2f** — which is the last of them. The list stays here so "what does the nav show"
 * has exactly one answer.
 *
 * **The cart is deliberately not a destination**, and neither is Products. The cart is
 * contextual chrome — `CartBar`, shown only while something is in it, the same argument
 * the walk-in `InLineBar` makes below — and Products is a segment of Discover sharing its
 * search box, which is the app's own IA (`customer_home.dart`'s `_segment`). Adding either
 * would put a permanent tab on something that is usually empty.
 */

export type Destination = {
  href: string;
  label: string;
  icon: typeof Icons.discover;
  ready: boolean;
  /** Which unread count, if any, badges this destination. */
  badge?: "messages" | "notifications";
} & NavMatch;

/** The five app tabs. The **only** things in the bottom bar — see `SECONDARY`. */
export const TABS: Destination[] = [
  // `alsoMatches` keeps Discover lit on a salon page, which is reached from here and
  // has no tab of its own. It used to be a `/salon` literal inside `isCurrent`; the
  // owner console needed the same helper without inheriting a customer path.
  { href: "/", label: "Discover", icon: Icons.discover, ready: true, alsoMatches: ["/salon"] },
  { href: "/map", label: "Map", icon: Icons.map, ready: true },
  { href: "/messages", label: "Chats", icon: Icons.chat, ready: true, badge: "messages" },
  { href: "/bookings", label: "Bookings", icon: Icons.booking, ready: true },
  { href: "/profile", label: "Profile", icon: Icons.person, ready: true },
];

/**
 * The app's drawer items, plus the bell.
 *
 * **These join the top nav at ≥744 and live on `/profile` below it.** The original rule
 * put them in the bottom bar too — right for a 1400px screen, wrong for a 390px one, and
 * 2d is where it ran out: turning Chats on would have made six items on a phone bar, and
 * 2e/2f would take it to nine. `/profile` already lists exactly this kind of row, which is
 * what the app's drawer is.
 *
 * Notifications sits here rather than in `TABS` because the app has no notifications tab —
 * it has a bell in the header, and at ≥744 this is that bell.
 */
export const SECONDARY: Destination[] = [
  {
    href: "/notifications",
    label: "Notifications",
    icon: Icons.notification,
    ready: true,
    badge: "notifications",
  },
  { href: "/saved", label: "Saved", icon: Icons.favourite, ready: true },
  { href: "/orders", label: "My orders", icon: Icons.shopBag, ready: true },
  { href: "/rewards", label: "My rewards", icon: Icons.reward, ready: true },
];

// **Settings was here and is gone on purpose, not deferred.** The app's screen holds
// two switches that write `notif_reminders` / `notif_promos` to SharedPreferences and
// that *nothing reads back* — the screen says so itself — plus two read-only facts.
// `profiles` has no preference columns at all, so there is nothing to persist and
// nothing to honour. The two facts (time zone, version) are an About block on
// `/profile`; a route holding a control that changes nothing would be the same
// dishonesty as promising a notification nothing sends. It comes back with push, along
// with the columns it would need.

export const readyTabs = () => TABS.filter((d) => d.ready);
export const readySecondary = () => SECONDARY.filter((d) => d.ready);

// `isCurrent` moved to `lib/nav.ts` in 3a and is re-exported here so the nav components
// keep one import. It is shared with the owner console, and its cases are pinned by
// `lib/nav.test.ts` — the `/salon` exception that used to be a literal in its body is now
// `alsoMatches` on Discover above.
export { isCurrent } from "@/lib/nav";

/**
 * True when something under `/profile` has unread items, so the Profile tab can carry a dot
 * at <744 where the badged destinations themselves are not on the bar.
 *
 * Without it a customer on a phone would have no visible signal that anything arrived —
 * the one thing an inbox must not do quietly.
 */
export function secondaryHasUnread(counts: {
  messages: number;
  notifications: number;
}): boolean {
  return readySecondary().some((d) => (d.badge ? counts[d.badge] > 0 : false));
}
