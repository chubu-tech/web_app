import { Icons } from "@/components/ui/icons";
import type { NavMatch } from "@/lib/nav";
import type { OwnerRowIcon } from "@/lib/owner/destinations";

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
 * **Settings is a hub, and that is where the app's drawer went.** The app reaches **ten**
 * things from a drawer; here they are the hub's two groups, which keeps the phone's bottom
 * bar short and keeps the split the app already draws: the tabs are the day, the rest is
 * work you do in bursts. Each is a real route rather than an accordion section — on the web a
 * reloadable, linkable, back-button-correct page is free, and the calendar's `?d=&view=` made
 * the same call in 3a.
 *
 * **All five are always reachable, but not always on screen.** There used to be a fixed bottom
 * bar carrying four of them, with Settings dropped into a header gear because five fixed
 * items at 390px leaves each 78px — the width at which "Calendar" truncates. The bar went
 * first (this is a website, not a phone app), taking `phoneOwnerTabs()` and the gear with it;
 * the scrollable strip that replaced it went next. From 1024 all five are inline in the
 * header; below it they are the collapse panel's five rows. Nothing here changes at either
 * width — this list is the whole set, and `components/owner/owner-nav.tsx` decides how it is
 * drawn.
 *
 * A separate module from the customer list rather than one parameterised list, because
 * the two navs differ in more than their items: the owner header carries a salon
 * switcher and a bell instead of a wordmark, has no "Sign in" call to action, and shows no
 * `InLineBar`. What they *do* share — how a path maps to a destination — is `lib/nav.ts`.
 *
 * **Nothing is left of the app's drawer.** Services and Staff arrived in 3b; Client book,
 * Product orders, Products, Offers, Loyalty, Payroll, Tax estimate and Plans & pricing arrived
 * in 3c. The rows themselves are now `lib/owner/destinations.ts` — pure data, so the two
 * invariants a drawer keeps breaking can be tested; this file keeps the tabs and resolves the
 * rows' glyph names.
 *
 * **`Add a walk-in` is deliberately not a hub row.** It is reached from the calendar, exactly as
 * the app reaches it from a FAB, because it is something you do *to* a day — and every hub row
 * carries the state of the thing it leads to, which an action has none of. The app added a
 * drawer row for it as a second path, and that row's only distinguishing content is a subtitle
 * this repo should not copy: it reads "Switched off in Settings" when `queue_enabled` is false,
 * but the screen behind it calls `create_booking`, not `join_queue`. An owner with the walk-in
 * *queue* switched off can still book a walk-in at the counter, so upstream's row tells them a
 * thing they can do is unavailable. Reported rather than ported.
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
      "/business/qr",
    ],
  },
];

/**
 * The glyph for one Settings hub row.
 *
 * The rows themselves live in `lib/owner/destinations.ts` as pure data carrying an icon **name**,
 * so their labels, blurbs and tier notes can be tested without dragging `lucide-react` and the
 * `@/` alias into a node-only suite. This is the other half: names to components, typed
 * `Record<OwnerRowIcon, …>` so a name with no glyph behind it is a compile error rather than a
 * blank square on the page.
 */
<<<<<<< HEAD
const ROW_ICONS: Record<OwnerRowIcon, typeof Icons.salon> = {
  salon: Icons.salon,
  clock: Icons.clock,
  haircut: Icons.haircut,
  people: Icons.people,
  clientBook: Icons.clientBook,
  shopBag: Icons.shopBag,
  product: Icons.product,
  offer: Icons.offer,
  reward: Icons.reward,
  payroll: Icons.payroll,
  tax: Icons.tax,
  premium: Icons.premium,
};
=======
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
  /**
   * Setup rather than back office, and it is the one row here that is not about *this*
   * salon: the page covers every salon the owner runs. It sits in this group because
   * equipping a counter is a thing you finish once — print it, stick it up, done — and
   * because it belongs beside the other "get the shop ready" rows rather than beside the
   * reports you come back to weekly. See the page's own note on why it is cross-salon.
   */
  {
    href: "/business/qr",
    label: "QR posters",
    icon: Icons.qr,
    blurb: "One permanent code per salon — book, shop or join the line",
  },
] as const;
>>>>>>> c67eb6b8491c7e8a01a1c510d39504e66ac7bef3

export function rowIcon(name: OwnerRowIcon): typeof Icons.salon {
  return ROW_ICONS[name];
}

export const readyOwnerTabs = () => OWNER_TABS.filter((d) => d.ready);
