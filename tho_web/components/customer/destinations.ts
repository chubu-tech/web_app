import { Icons } from "@/components/ui/icons";

/**
 * The customer navigation, in one place.
 *
 * The five tabs mirror `customer_home.dart:211` — Discover · Map · Chats ·
 * Bookings · Profile — and the secondary items mirror the app's drawer
 * (`customer_home.dart:166`).
 *
 * **`ready` is the gate.** A destination only appears once its route exists, so no
 * tab ever leads somewhere unfinished. Each later milestone flips one flag on as it
 * lands: Bookings with 2b, Chats/Map/Profile with 2d. The list stays here so
 * "what does the nav show" has exactly one answer.
 */

export type Destination = {
  href: string;
  label: string;
  icon: typeof Icons.discover;
  ready: boolean;
};

/** The tab bar (bottom under 744, top nav at or above it). */
export const TABS: Destination[] = [
  { href: "/", label: "Discover", icon: Icons.discover, ready: true },
  { href: "/map", label: "Map", icon: Icons.map, ready: false },
  { href: "/messages", label: "Chats", icon: Icons.chat, ready: false },
  { href: "/bookings", label: "Bookings", icon: Icons.booking, ready: true },
  { href: "/profile", label: "Profile", icon: Icons.person, ready: true },
];

/**
 * The app's drawer items. On the web these join the top nav at ≥744 and the tab bar
 * under it — a hamburger drawer on a 1400px screen hides things that fit on screen.
 */
export const SECONDARY: Destination[] = [
  { href: "/saved", label: "Saved", icon: Icons.favourite, ready: true },
  { href: "/orders", label: "My orders", icon: Icons.shopBag, ready: false },
  { href: "/rewards", label: "My rewards", icon: Icons.reward, ready: false },
  { href: "/settings", label: "Settings", icon: Icons.settings, ready: false },
];

export const readyTabs = () => TABS.filter((d) => d.ready);
export const readySecondary = () => SECONDARY.filter((d) => d.ready);

/**
 * True when `href` is the destination the given path belongs to. Exact for "/",
 * prefix otherwise, so `/salon/123` still highlights Discover — it is reached from
 * there and has no tab of its own.
 */
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/salon");
  return pathname === href || pathname.startsWith(`${href}/`);
}
