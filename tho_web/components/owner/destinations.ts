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
 * what an owner's day is made of. 3a landed **Calendar** and **Queue**, 3b turned on
 * Settings, and 3c turns on **Insights** and **Messages**: every tab is now real.
 *
 * **Settings is a hub, and that is where the app's drawer went.** The app reaches eleven
 * things from a drawer; here they are the hub's two groups, which keeps the phone's bottom
 * bar short and keeps the split the app already draws: the tabs are the day, the rest is
 * work you do in bursts. Each is a real route rather than an accordion section — on the web a
 * reloadable, linkable, back-button-correct page is free, and the calendar's `?d=&view=` made
 * the same call in 3a.
 *
 * **The phone bar carries four of the five.** `phoneOwnerTabs()` drops Settings, which moves
 * to a gear in the header — see `owner-nav.tsx` for the width arithmetic. Five fixed items at
 * 390px is one too many.
 *
 * A separate module from the customer list rather than one parameterised list, because
 * the two navs differ in more than their items: the owner header carries a salon
 * switcher and a bell instead of a wordmark, has no "Sign in" call to action, and shows no
 * `InLineBar`. What they *do* share — how a path maps to a destination — is `lib/nav.ts`.
 *
 * **Nothing is left of the app's drawer.** Services and Staff arrived in 3b; Client book,
 * Product orders, Products, Offers, Loyalty, Payroll, Tax estimate and Plan & billing arrived
 * in 3c. `Add a walk-in` is deliberately not a destination in either place:
 * `/business/walk-in` is reached from the calendar, exactly as the app reaches it from a FAB,
 * because it is something you do *to* a day.
 */

export type OwnerDestination = {
  href: string;
  label: string;
  icon: typeof Icons.booking;
  ready: boolean;
} & NavMatch;

export const OWNER_TABS: OwnerDestination[] = [
  {
    href: "/business/insights",
    label: "Insights",
    icon: Icons.insights,
    ready: true,
    // The back-office routes that are *reports* rather than settings keep Insights lit: an
    // owner reading payroll or the tax estimate is doing the same job as reading the trends,
    // and the hub row they arrived from is under Settings only because that is where the list
    // of them lives.
    alsoMatches: ["/business/payroll", "/business/tax"],
  },
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
  { href: "/business/messages", label: "Messages", icon: Icons.chat, ready: true },
  {
    href: "/business/settings",
    label: "Settings",
    icon: Icons.settings,
    ready: true,
    // The hub's own sub-routes, plus the ones that live at the top level because they are
    // long-lived nouns rather than settings: an owner links to `/business/services`, and
    // `/business/staff/<id>` is a person. Without these the tab goes dark the moment you
    // open anything it lists.
    alsoMatches: [
      "/business/services",
      "/business/staff",
      "/business/hours",
      "/business/new",
      "/business/clients",
      "/business/orders",
      "/business/products",
      "/business/offers",
      "/business/loyalty",
      "/business/plans",
    ],
  },
];

/**
 * The Settings hub's first group: what customers see, and what the booking engine works from.
 *
 * Separate from `OWNER_TABS` because these are *destinations within* a tab — the nav
 * highlights Settings for all of them, and the hub is what distinguishes them.
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

/**
 * The hub's second group: running the business rather than setting it up.
 *
 * Two groups instead of one list of ten, because they answer different questions and get
 * opened on different days. Setup is what you finish once; this is what you come back to.
 */
export const BACK_OFFICE_DESTINATIONS = [
  {
    href: "/business/clients",
    label: "Client book",
    icon: Icons.people,
    blurb: "Your regulars, their spend, and who has quietly stopped coming",
  },
  {
    href: "/business/orders",
    label: "Product orders",
    icon: Icons.shopBag,
    blurb: "What customers have ordered and what is ready to collect",
  },
  {
    href: "/business/products",
    label: "Products",
    icon: Icons.product,
    blurb: "What you sell, and what is in stock",
  },
  {
    href: "/business/offers",
    label: "Offers",
    icon: Icons.offer,
    blurb: "Promotions on your salon page and in the customer feed",
  },
  {
    href: "/business/loyalty",
    label: "Loyalty",
    icon: Icons.reward,
    blurb: "Points, rewards, and the codes customers bring in",
  },
  {
    href: "/business/payroll",
    label: "Payroll",
    icon: Icons.payroll,
    blurb: "Commission and base pay, per stylist, per month",
  },
  {
    href: "/business/tax",
    label: "Tax estimate",
    icon: Icons.tax,
    blurb: "Turnover, presumptive income tax and the GST threshold",
  },
  {
    href: "/business/plans",
    label: "Plan & billing",
    icon: Icons.premium,
    blurb: "What you are on, what each tier costs, and how to move",
  },
] as const;

export const readyOwnerTabs = () => OWNER_TABS.filter((d) => d.ready);

/**
 * The phone bar's four. Settings is reachable from the header gear instead — five fixed items
 * at 390px leaves each one too narrow to label.
 */
export const phoneOwnerTabs = () =>
  readyOwnerTabs().filter((d) => d.href !== "/business/settings");
