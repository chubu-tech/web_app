import { Icons } from "@/components/ui/icons";
import type { NavMatch } from "@/lib/nav";

/**
 * The owner console's navigation, in one place — the mirror of
 * `components/customer/destinations.ts`, and the same `ready` discipline: **a
 * destination appears only once its route does**, so no tab ever leads somewhere
 * unfinished. Flip a flag in the milestone that lands the route.
 *
 * The five tabs are the app's (`business_home.dart`'s `AppNavBar`), in its order —
 * Insights · Calendar · Queue · Messages · Settings — so the two clients agree about
 * what an owner's day is made of. 3a lands **Calendar** and **Queue**; 3b turns on
 * Settings, 3c Insights and Messages.
 *
 * A separate module from the customer list rather than one parameterised list, because
 * the two navs differ in more than their items: the owner header carries a salon
 * switcher instead of a wordmark, has no "Sign in" call to action, and shows no
 * `InLineBar`. What they *do* share — how a path maps to a destination — is
 * `lib/nav.ts`.
 *
 * **The app's 11-item drawer is not here yet.** Services, Staff, Add a walk-in, Client
 * book, Product orders, Offers, Loyalty, Payroll, Tax estimate and Plan & billing all
 * belong to 3b and 3c, and each arrives with its route. `/business/walk-in` exists in
 * 3a but is reached from the calendar rather than the nav, exactly as the app reaches
 * it from a FAB.
 */

export type OwnerDestination = {
  href: string;
  label: string;
  icon: typeof Icons.booking;
  ready: boolean;
} & NavMatch;

export const OWNER_TABS: OwnerDestination[] = [
  { href: "/business/insights", label: "Insights", icon: Icons.insights, ready: false },
  {
    href: "/business",
    label: "Calendar",
    icon: Icons.booking,
    ready: true,
    // The console's root is the prefix of every other owner route, so it must match
    // exactly or it lights up on the queue board too. The two pages it *opens* —
    // one booking, and the walk-in form — keep it lit, since neither has a tab.
    exact: true,
    alsoMatches: ["/business/bookings", "/business/walk-in"],
  },
  { href: "/business/queue", label: "Queue", icon: Icons.queue, ready: true },
  { href: "/business/messages", label: "Messages", icon: Icons.chat, ready: false },
  { href: "/business/settings", label: "Settings", icon: Icons.settings, ready: false },
];

export const readyOwnerTabs = () => OWNER_TABS.filter((d) => d.ready);
