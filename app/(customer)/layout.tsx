import type { Viewport } from "next";
import { CartBar } from "@/components/customer/cart-bar";
import { CustomerHeader } from "@/components/customer/customer-nav";
import { InLineBar } from "@/components/customer/in-line-bar";
import { SiteFooter } from "@/components/customer/site-footer";
import { CustomerGuideLauncher } from "@/components/customer/customer-guide-launcher";
import { requireLiveAccount } from "@/lib/session";

/**
 * The cream canvas, so the browser chrome matches the page rather than the owner
 * console's white. A nested `viewport` overwrites the root's — nested segments win, per
 * Next's metadata merging.
 */
export const viewport: Viewport = { themeColor: "#f6f3ee" };

/**
 * The customer shell, ported from `CustomerHome`'s `Scaffold`
 * (`tho/app/lib/customer/customer_home.dart:219`).
 *
 * The nav is the only shared chrome. Discover and the salon page render their own
 * headers, exactly as the app does — `customer_home.dart:222` drops the AppBar on
 * the first two tabs because each has its own.
 *
 * **`main` reserves nothing any more.** It used to carry 62px of bottom padding plus the
 * safe-area inset, for the fixed bottom tab bar. That bar is
 * gone — this is a website, and a thumb-reachable tab strip is a phone idiom — so the one
 * piece of chrome is the sticky header above, which is in normal flow and needs no
 * reservation at all. Anything that was pinned above the old bar now sits on the bottom
 * edge; see `CartBar` and the three CTA footers.
 */
export default async function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // A guest counts as not signed in: they hold a session but no account, so the
  // nav should still offer the way in.
  //
  // `requireLiveAccount` rather than `getAccount`: a deleted or suspended session is
  // stopped here, before the shell, exactly as `auth_gate.dart:127` stops it before the
  // role switch. Anonymous visitors and guests pass straight through — there is no
  // profile row to judge — so the public site is untouched.
  const account = await requireLiveAccount();

  return (
    /*
      `data-shell="customer"` is what switches this whole subtree onto the editorial
      token layer — see the scope block in `app/globals.css`. It has to be here rather
      than in the root layout, which cannot know the route without calling `headers()`
      and forcing every page dynamic. `bg-canvas` on the wrapper is belt to the
      `body:has()` brace: body carries the cream for overscroll, this covers the subtree.
    */
    <div data-shell="customer" className="bg-canvas flex min-h-full flex-col">
      <CustomerHeader signedIn={account.state === "registered"} />
      {/* Below the nav rather than above it, so the shop's chrome stays where it is
          and the bar reads as a notice about *this* session, not part of the site. */}
      <InLineBar />
      {/*
          `id="main"` is the skip link's target, and it was missing here.

          `app/layout.tsx` renders "Skip to content" on **every** route with
          `href="#main"`, and its comment says it "now serves every route rather than
          three". It did not: only the three marketing surfaces declared the id, so on the
          entire product half the first thing a keyboard or screen-reader user reached was
          a link that went nowhere.
        */}
        <main id="main" className="flex-1">{children}</main>
      {/*
        `main` is `flex-1` inside a `min-h-full` column, so on a short page — an empty
        `/saved`, a 404 — the footer is pushed to the bottom of the viewport rather than
        floating under three lines of content. That is the whole reason it goes here and
        not at the end of each page.

        `signedIn` decides whether it offers a way in; the year is resolved here because
        the footer is a client component and evaluating it there would be evaluated twice.
        It renders nothing on the four routes that own their viewport — see the component.
      */}
      <SiteFooter
        signedIn={account.state === "registered"}
        year={new Date().getFullYear()}
      />
      {/*
        In the shell rather than on the two pages that fill the cart, because a customer who adds
        something and then wanders to `/bookings` should still be able to find it. The app has to
        render it per-screen; a persistent shell is a thing only the web gets for free. It hides
        itself when the cart is empty and on `/cart` — see `CartBar`.
      */}
      <CartBar />
      {/*
        The floating "How it works" button, and the customer walkthrough behind it. In the
        shell rather than on a page because a first-time visitor can arrive on any of these
        25 routes — from a search result, a shared salon link, a printed QR — and the guide
        is only useful where somebody is already lost.

        It places itself: `lib/guide/placement.ts` lifts it clear of the five surfaces here
        that pin a control to the bottom edge (this bar included) and declines to draw at all
        on `/map`, where the tile attribution owns the corner. The player is loaded on press,
        so this costs one button until somebody wants it.
      */}
      <CustomerGuideLauncher />
    </div>
  );
}
