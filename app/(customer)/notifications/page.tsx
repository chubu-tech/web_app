import type { Metadata } from "next";
import Link from "next/link";
import { NotificationList } from "@/components/customer/notification-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchNotifications } from "@/lib/api/notifications";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

/**
 * The notification inbox.
 *
 * **Registered only.** `notifications_select` scopes rows to
 * `recipient_profile_id = auth.uid()`, and nothing writes a notification to a guest — a
 * guest cannot book, queue or order, which is everything that produces one. So an empty
 * list for a guest would be a true but useless page; it says why instead.
 */
export default async function NotificationsPage() {
  const account = await getAccount();

  if (account.state !== "registered") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.notification}
          title="Nothing to show yet"
          message="Booking updates, reminders and queue calls land here once you have an account."
          action={
            <Link href={`/sign-${account.state === "guest" ? "up" : "in"}?next=/notifications`}>
              <Button>{account.state === "guest" ? "Create an account" : "Sign in"}</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  const supabase = await createClient();
  /*
    **No catch.** This used to be `.catch(() => [])`, which turned an outage into the empty
    state below — somebody with a full list was told they had nothing, in the app's own
    encouraging words. There was no `error.tsx` anywhere when that was written, so swallowing
    was the only alternative to Next's default error page; now the segment has a boundary and a
    failed read can say it failed.

    The session is already established above, so nothing here fails for a signed-out visitor:
    a throw means the read itself broke.
  */
  const items = await fetchNotifications(supabase);

  /**
   * The render clock, resolved here and threaded down.
   *
   * This page reads cookies, so it is always rendered per request and "now" is genuinely
   * now — the same reasoning the booking page's cancellation window carries. Resolving it
   * here keeps the client list pure: it groups and ages against a value it was handed
   * rather than one it read mid-render, so two renders cannot disagree.
   */
  const now = new Date();

  return (
    <Shell>
      <NotificationList initial={items} now={now} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">{children}</div>
  );
}
