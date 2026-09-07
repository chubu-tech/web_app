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
 * So the attribute is here now, and the group renders on the same ground as the other 51
 * routes.
 *
 * **That ground is white again**, not cream: the canvas port moved `--color-canvas` to
 * `tokens.dart`'s `#ffffff` for every shell, so the seam is closed from the other side. The
 * attribute still earns its place — it is what scopes the public documents to the web type
 * scale (`[data-shell="marketing"]` in `globals.css`) now that the product carries the app's.
 *
 * Two consequences worth knowing before editing anything under `components/marketing`:
 *
 * 1. **A card is `bg-paper`, not `bg-canvas`.** `canvas` is the page, `paper` is a thing
 *    lifted off it. With a white canvas the two resolve to the same colour, so a surface that
 *    must read as lifted needs `shadow-card` — the same way the app does it. Keep asking for
 *    `paper` regardless: it records the intent, and it is what makes the distinction
 *    recoverable if the ground ever moves again. Roughly 18 surfaces were reclassified in the same change — the hero's queue card,
 *    the search bar, the pricing cards, the plan mock's chips, the waitlist modal. Reach for
 *    `paper` whenever the element carries `shadow-card` or a ring.
 * 2. **`bg-surface-soft` and `bg-surface-strong` are neutral greys again** — `#f7f7f7` and
 *    `#f2f2f2`, `tokens.dart`'s values. They spent one release as warm tints of cream
 *    (`#efe9e1` / `#e6ded2`), and nothing referencing them needed changing in either
 *    direction, which is the whole point of the token indirection. The rule that follows is
 *    the opposite of the one that used to be here: a hardcoded warm grey is now the thing
 *    that will read as a stain on a cold page.
 *
 * `viewport.themeColor` below still follows the canvas, for the reason it always did — the
 * browser chrome on a phone is part of the page — but every shell now agrees on `#ffffff`,
 * so the three declarations are a belt rather than three different answers.
 */
export const viewport: Viewport = {
  themeColor: "#ffffff",
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
          Out here nobody has signed in, so the route is the only evidence of who is reading
          — see `MarketingGuideLauncher`, which is where that guess is made and explained.
        */}
        <MarketingGuideLauncher />
      </div>
    </WaitlistProvider>
  );
}
