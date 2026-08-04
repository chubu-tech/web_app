import type { Metadata } from "next";
import { OwnerHeader, OwnerTabBar } from "@/components/owner/owner-nav";
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
 *   `hidden tablet:block`. It carries the salon switcher, and an owner running nine
 *   salons has to be able to switch on a phone standing at the till.
 * - **No `InLineBar`.** That is a customer's own place in a queue; an owner's queue is
 *   a tab, and the two would be confusing side by side.
 * - **No "Sign in" call to action.** Nobody reaches this shell without a session.
 *
 * The bottom bar and `main`'s padding follow the customer shell exactly — 62px plus the
 * safe-area inset below 744, dropped at `tablet:` — because the tab bar is `fixed` and
 * would otherwise sit on top of the last row of the page.
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
    <div className="flex min-h-full flex-col">
      <OwnerHeader
        active={active}
        businesses={businesses}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
      />
      <main className="flex-1 pb-[calc(62px+env(safe-area-inset-bottom))] tablet:pb-0">
        {children}
      </main>
      <OwnerTabBar unreadMessages={unreadMessages} />
    </div>
  );
}
