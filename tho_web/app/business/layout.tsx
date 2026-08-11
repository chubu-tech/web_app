import type { Metadata } from "next";
import { OwnerHeader } from "@/components/owner/owner-nav";
import { SalonSwitcher } from "@/components/owner/salon-switcher";
import { unreadNotificationCount } from "@/lib/api/notifications";
import { fetchOwnerConversations } from "@/lib/api/owner-back-office";
import { unreadThreadCount } from "@/lib/chat-logic";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { template: "%s · Tho for salons", default: "Tho for salons" },
};

/**
 * The owner console's shell — a port of `business_home.dart`'s `Scaffold`.
 *
 * **This is the gate.** `getOwnerContext` refuses anyone who is not an owner and is
 * memoised for the request, so the page inside resolves the same salon from the same
 * read. `proxy.ts` deliberately does no role checking: role is a table column, so a
 * check there would cost a `profiles` query on every public request too.
 *
 * Three differences from the customer shell, each with a reason:
 *
 * - **The header is on screen at every width**, where the customer's top nav is
 *   `hidden tablet:block`. It used to be *because* it carried the salon switcher; the
 *   switcher has its own row now, and the header stays because a console's destinations
 *   are the things an owner touches all day.
 * - **No `InLineBar`.** That is a customer's own place in a queue; an owner's queue is
 *   a tab, and the two would be confusing side by side.
 * - **No "Sign in" call to action.** Nobody reaches this shell without a session.
 *
 * **There is no bottom bar and `main` reserves nothing.** Both shells lost their fixed tab
 * bar: this is a website, not a phone app. What `main` *does* sit below is `AppHeader`'s
 * in-flow spacer — the header is `fixed`, so a div of exactly `--header-height` is what puts
 * the content back where a sticky header had it. Do not add top padding here as well.
 *
 * This comment used to promise a second header row below 744 carrying a scrollable tab strip.
 * That strip is gone: it only ever covered *below* 744, and the range that was actually
 * cramped was 744–1024, so the destinations now collapse into a hamburger at
 * `--breakpoint-console` instead. The reasoning behind the strip — an owner works one-handed
 * at a till and a tap plus an overlay is the wrong toll for the five things they touch all
 * day — still stands; if it turns out to matter, bring the strip back at 1024, not 744.
 */
export default async function OwnerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { businesses, active, userId } = await getOwnerContext();

  // The two badges. Both are counts the shell shows on every owner route, so they are read here
  // rather than in each page — and both fail to 0 rather than taking the console down: a badge is
  // the least important thing on any of these screens.
  //
  // Notifications are addressed to a *person* (`recipient_profile_id`), so this count spans every
  // salon the owner runs; messages are scoped to the active salon, because a reply is sent as one
  // salon and the header names which. Two different scopes, deliberately.
  const supabase = await createClient();
  const [unreadNotifications, conversations] = await Promise.all([
    unreadNotificationCount(supabase).catch(() => 0),
    active ? fetchOwnerConversations(supabase, active.id).catch(() => []) : Promise.resolve([]),
  ]);
  const unreadMessages = unreadThreadCount(conversations, userId);

  return (
    /*
      `data-shell="owner"` is what puts the console on the same editorial canvas as the
      customer routes and the marketing site — see the scope block in `app/globals.css`,
      which now matches on the attribute's presence rather than on the value `customer`.
      `bg-canvas` on the wrapper is belt to the `body:has()` brace: body carries the cream
      so overscroll does not flash white, this covers the subtree.
    */
    <div data-shell="owner" className="bg-canvas flex min-h-full flex-col">
      <OwnerHeader
        active={active}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
      />

      {/*
        The salon switcher's dedicated row, between the chrome and the page.

        It was the header's left slot — a dropdown where every other nav in the product has
        the logo. Which salon the console is showing is *page context*, not navigation: it
        decides what every figure below it means, so it belongs with the content and scrolls
        away with it. See the note in `components/owner/salon-switcher.tsx`.

        **Outside `main`, and one row for all 26 routes.** Inside `main` it would be the
        route's own content, which it is not — every page here already opens with its own
        `<h1>`, and a switcher above that heading on 26 pages is 26 places to forget it.
        Rendered here it also reads from the layout's single memoised `getOwnerContext`,
        so the row and the page cannot disagree about which salon is active.

        It renders nothing when there is no salon yet, so `NoSalonYet` below is the only
        thing that states that case.
      */}
      <SalonSwitcher active={active} businesses={businesses} />

      <main className="flex-1">{children}</main>
    </div>
  );
}
