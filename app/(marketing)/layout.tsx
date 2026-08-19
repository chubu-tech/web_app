import type { Viewport } from "next";
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
 * ## `data-shell="marketing"`, and this reverses what used to be written here
 *
 * This block used to explain why the attribute was deliberately absent: the public pages
 * "are what that editorial layer was copied *from*, so they want the base tokens exactly as
 * declared", and adding a shell attribute "would re-skin them against themselves".
 *
 * That was true while the cream came from `../landing_page` and these pages were cream too.
 * It stopped being true when the marketing redesign moved them onto a white canvas
 * (`app/marketing-tokens.css` — "a **white canvas** carrying near-black ink") and the
 * product shells kept the cream. From then on the sentence described a world that no longer
 * existed, and what it licensed was a visible seam: `/` on `#ffffff`, `/discover` on
 * `#f6f3ee`, one nav between them. A visitor arriving from the marketing site and tapping
 * into the product watched the page change colour — the precise thing the `[data-shell]`
 * block in `globals.css` was widened to stop, one boundary further out.
 *
 * So the attribute is here now, and the group renders on the same cream as the other 51
 * routes. Two consequences worth knowing before editing anything under `components/marketing`:
 *
 * 1. **A card is `bg-paper`, not `bg-canvas`.** Those were interchangeable while canvas was
 *    white and they are not any more: `canvas` is the page, `paper` is a thing lifted off
 *    it. Roughly 18 surfaces were reclassified in the same change — the hero's queue card,
 *    the search bar, the pricing cards, the plan mock's chips, the waitlist modal. Reach for
 *    `paper` whenever the element carries `shadow-card` or a ring.
 * 2. **`bg-surface-soft` and `bg-surface-strong` are now tints OF cream** (`#efe9e1`,
 *    `#e6ded2`) rather than tints of white. Nothing referencing them needed changing, which
 *    is the point of the token indirection — but a new value hardcoded as a grey will read
 *    as a cold patch on a warm page.
 *
 * `viewport.themeColor` below follows the canvas for the same reason `app/(customer)` sets
 * its own: the browser chrome on a phone is part of the page, and a white status bar above a
 * cream document is the seam again, in miniature.
 */
export const viewport: Viewport = {
  themeColor: "#f6f3ee",
  colorScheme: "light",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WaitlistProvider>
      {/*
        `bg-canvas` on the wrapper as well as the attribute: the attribute re-points the
        variable, and something still has to paint it. The `body:has([data-shell])` half of
        the rule in `globals.css` covers the viewport itself (iOS overscroll), so this is
        belt and braces for the document flow rather than a duplicate.
      */}
      <div
        data-shell="marketing"
        className="bg-canvas flex min-h-full flex-col"
      >
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
      </div>
    </WaitlistProvider>
  );
}
