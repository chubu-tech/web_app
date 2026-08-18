import { MarketingGuideLauncher } from "@/components/guide/marketing-guide-launcher";
import { WaitlistProvider } from "@/components/marketing/waitlist-provider";

/**
 * The public marketing site's shell — `/`, `/waitlist`, and the four documents in
 * `(documents)`: `/help`, `/legal/terms`, `/privacy` and `/legal/content-policy`.
 *
 * ## Why this exists at all
 *
 * Before the merge these three pages were their own Next application and their root layout
 * carried `WaitlistProvider`. There can be exactly one root layout now, and it is shared with
 * 60-odd product routes that have no use for a waitlist modal — so the provider moved down
 * here, to the group that actually opens it. A customer reading their bookings does not
 * download a modal host for a marketing call to action.
 *
 * ## It is a route group, so it adds no path segment
 *
 * `app/(marketing)/page.tsx` is `/`, not `/marketing`. That is the whole point: the landing
 * page stays the public-facing homepage while the product keeps its own URLs, and the two
 * only meet at the root layout. The nested `(documents)` group works the same way, which is
 * how three policy pages moved out of `app/(customer)/` without one URL changing.
 *
 * ## No `data-shell` wrapper
 *
 * The customer group sets `data-shell="customer"` and the console sets `data-shell="owner"`,
 * both of which re-point colour variables at `:root`'s values. The marketing pages are what
 * that editorial layer was copied *from*, so they want the base tokens exactly as declared —
 * `app/marketing-tokens.css` supplies the rest, and adding a shell attribute here would
 * re-skin them against themselves.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WaitlistProvider>
      {children}
      {/*
        "How it works", on the pages somebody reaches before they have an account — which is
        the audience a first-run guide is actually for. The walkthrough it opens is the same
        one the product shells mount, so a visitor who watches it here and then signs up
        meets the screens they were just shown.

        `MarketingGuideLauncher` picks the audience from the route, because out here nobody
        has signed in and `/for-salons` is the one page addressed to salon owners. Removing
        the button from the public site is deleting this line.
      */}
      <MarketingGuideLauncher />
    </WaitlistProvider>
  );
}
