/**
 * What an owner **reads** on a Settings hub row before opening it: its label, its glyph, the
 * line under it, and the tier note marking a destination their plan does not include.
 *
 * A port of `ownerDestinationEntry` in `tho/app/lib/business/business_home.dart`, and split from
 * the rows themselves for the reason the Dart gives: the hub is a component, this repo has no
 * component tests, and so nothing could otherwise assert that **every gated row is marked** or
 * that **no two rows wear one glyph**. Those are exactly the two faults that reached production
 * upstream — "Product orders" went gated-but-unmarked, and Staff and Client book ended up sharing
 * one glyph. The second of the two was live here too.
 *
 * The glyph is a **name** rather than a component, which is the whole trick: a component would
 * drag `lucide-react` and the `@/` alias into a suite that has neither jsdom nor a config file,
 * and a string is what makes uniqueness assertable. `components/owner/destinations.ts` resolves
 * the names through a `Record` typed over this union, so a name with no glyph behind it is a
 * compile error rather than a blank square.
 *
 * **The tier note is a courtesy, not a control.** Every row stays a live link and the server
 * remains the authority; this only stops an owner walking into a screen whose every write will
 * refuse. It is derived from the row's `feature` rather than written out per row, so it cannot
 * name the wrong tier and cannot be forgotten on a row that has one.
 */

import { hasFeature, tierForFeature, type Feature } from "../entitlements";
import { planTierFor } from "../plans";

/** Every glyph the hub uses, by name. One row, one name — see the uniqueness test. */
export type OwnerRowIcon =
  | "salon"
  | "clock"
  | "haircut"
  | "people"
  | "clientBook"
  | "shopBag"
  | "product"
  | "offer"
  | "reward"
  | "payroll"
  | "tax"
  | "premium";

export type OwnerRow = {
  href: string;
  label: string;
  icon: OwnerRowIcon;
  /** What the destination is, in one line. Static — the *state* line is computed per salon. */
  blurb: string;
  /** The entitlement behind this row, where there is one. Absent means every plan has it. */
  feature?: Feature;
};

/**
 * The hub's first group: what customers see, and what the booking engine works from.
 *
 * None of it is gated. A Basic salon still has a name, hours, a menu and a team — gating setup
 * would be gating the product.
 */
export const SETUP_ROWS: readonly OwnerRow[] = [
  {
    href: "/business/settings/salon",
    label: "Salon details",
    icon: "salon",
    blurb: "Name, type, address, contact, photos and the map pin",
  },
  {
    href: "/business/hours",
    label: "Opening hours",
    icon: "clock",
    blurb: "When the shop is open, day by day",
  },
  {
    href: "/business/services",
    label: "Services",
    icon: "haircut",
    blurb: "What you offer, how long it takes and what it costs",
  },
  {
    href: "/business/staff",
    label: "Staff",
    icon: "people",
    blurb: "Your team, what each of them does, and when they work",
  },
];

/**
 * The hub's second group: running the business rather than setting it up.
 *
 * Two groups instead of one list, because they answer different questions and get opened on
 * different days. Setup is what you finish once; this is what you come back to.
 */
export const BACK_OFFICE_ROWS: readonly OwnerRow[] = [
  {
    href: "/business/clients",
    label: "Client book",
    // Not `people`: that is the salon's own team, one group above. The two rows shared a glyph
    // until now, which is the same collision upstream found in its own drawer — a list where two
    // rows look alike is a list you read by position rather than by icon.
    icon: "clientBook",
    blurb: "Your regulars, their spend, and who has quietly stopped coming",
    feature: "clientBook",
  },
  {
    href: "/business/orders",
    label: "Product orders",
    icon: "shopBag",
    blurb: "What customers have ordered and what is ready to collect",
    // Everything behind this row checks the storefront — the insights inbox card, the products
    // page, the shop analytics — so it is gated exactly as Client book and Loyalty are.
    feature: "productStore",
  },
  {
    href: "/business/products",
    label: "Products",
    icon: "product",
    blurb: "What you sell, and what is in stock",
    feature: "productStore",
  },
  {
    href: "/business/offers",
    label: "Offers",
    icon: "offer",
    blurb: "Promotions on your salon page and in the customer feed",
  },
  {
    href: "/business/loyalty",
    label: "Loyalty",
    icon: "reward",
    blurb: "Points, rewards, and the codes customers bring in",
    feature: "loyalty",
  },
  {
    href: "/business/payroll",
    label: "Payroll",
    icon: "payroll",
    blurb: "Commission and base pay, per stylist, per month",
    feature: "commissions",
  },
  {
    href: "/business/tax",
    label: "Tax estimate",
    icon: "tax",
    blurb: "Turnover, presumptive income tax and the GST threshold",
    feature: "commissions",
  },
  {
    href: "/business/plans",
    // "Plans & pricing", not "Plan & billing" — the app's rename, and the one row where the
    // screen's own name was the correct one. There is no billing to reach: payment is off-app,
    // App Store Review Guideline 3.1.1 is why there never will be, and a row promising billing
    // promises a screen that cannot be built.
    label: "Plans & pricing",
    icon: "premium",
    blurb: "What you are on, what each tier costs, and how to move",
  },
];

export const OWNER_ROWS: readonly OwnerRow[] = [...SETUP_ROWS, ...BACK_OFFICE_ROWS];

/**
 * The line marking a row this salon's plan does not include — `"Growth plan and up"` — or null
 * when they have it, or when the row was never gated.
 *
 * Derived from the row's own `feature` through `tierForFeature`, so the tier named here and the
 * tier that actually unlocks the screen are the same fact read twice rather than two strings that
 * can drift. The hub used to infer "locked" from a null count handed down by the page and write
 * the tier out by hand at each row, which is a rule expressed four times in a place a test cannot
 * see.
 */
export function tierNoteFor(row: OwnerRow, plan: string | null | undefined): string | null {
  if (!row.feature || hasFeature(plan, row.feature)) return null;
  return `${planTierFor(tierForFeature(row.feature)).name} plan and up`;
}
