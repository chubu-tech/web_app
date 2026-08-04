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
 * **Settings is a hub, and that is where the app's drawer went.** Services and Staff are
 * drawer items in the app and sub-routes of Settings here, which keeps the phone's bottom
 * bar at three items and keeps the split the app already draws: the tabs are the day, the
 * rest is setup you do in bursts. Each is a real route rather than an accordion section —
 * on the web a reloadable, linkable, back-button-correct page is free, and the calendar's
 * `?d=&view=` made the same call in 3a.
 *
 * A separate module from the customer list rather than one parameterised list, because
 * the two navs differ in more than their items: the owner header carries a salon
 * switcher instead of a wordmark, has no "Sign in" call to action, and shows no
 * `InLineBar`. What they *do* share — how a path maps to a destination — is
 * `lib/nav.ts`.
 *
 * **What is left of the app's 11-item drawer.** Services and Staff arrived in 3b, under
 * Settings. Client book, Product orders, Offers, Loyalty, Payroll, Tax estimate and Plan &
 * billing are 3c, and each arrives with its route. `Add a walk-in` is deliberately not a
 * destination in either place: `/business/walk-in` is reached from the calendar, exactly as
 * the app reaches it from a FAB, because it is something you do *to* a day.
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
  {
    href: "/business/settings",
    label: "Settings",
    icon: Icons.settings,
    ready: true,
    // The hub's own sub-routes, plus the two that live at the top level because they are
    // long-lived nouns rather than settings: an owner links to `/business/services`, and
    // `/business/staff/<id>` is a person. Without these the tab goes dark the moment you
    // open anything it lists.
    alsoMatches: ["/business/services", "/business/staff", "/business/hours", "/business/new"],
  },
];

/**
 * The Settings hub's own rows. Separate from `OWNER_TABS` because these are *destinations
 * within* a tab — the nav highlights Settings for all of them, and the hub is what
 * distinguishes them.
 */
export const SETUP_DESTINATIONS = [
  {
    href: "/business/settings/salon",
    label: "Salon details",
    icon: Icons.salon,
    blurb: "Name, type, address, contact, photos and the map pin",
  },
  {
    href: "/business/hours",
    label: "Opening hours",
    icon: Icons.clock,
    blurb: "When the shop is open, day by day",
  },
  {
    href: "/business/services",
    label: "Services",
    icon: Icons.haircut,
    blurb: "What you offer, how long it takes and what it costs",
  },
  {
    href: "/business/staff",
    label: "Staff",
    icon: Icons.people,
    blurb: "Your team, what each of them does, and when they work",
  },
] as const;

export const readyOwnerTabs = () => OWNER_TABS.filter((d) => d.ready);
