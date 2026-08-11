import type { Metadata } from "next";
import { NotificationList } from "@/components/customer/notification-list";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { fetchNotifications } from "@/lib/api/notifications";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

/**
 * The owner's bell — a port of the app's `NotificationsBell` and `notifications_screen.dart`,
 * read as the salon rather than as a customer.
 *
 * **`notifications` is addressed to a *person*, not to a salon.** `recipient_profile_id` is the
 * only routing there is, and `private.enqueue_order_notification` sends the salon's copies to
 * `public.business_owner_profile(business_id)` — so an owner's rows are whatever the platform
 * decided to tell *them*, across every salon they run, and there is no `business_id` to filter
 * on. This page therefore does not scope to the active salon, and says so: switching salons in
 * the header changes nothing here.
 *
 * That also means a *stylist* with a linked login receives none of it. Notifications to a salon
 * go to its owner alone, which is a real limitation of the schema and not something this page can
 * work around.
 *
 * Live, the owner holds **27 rows, 14 unread** — 18 `booking_created`, 6 `booking_cancelled`, 2
 * `order_placed`, 1 `order_cancelled`. The last two have no case at all in the customer's copy
 * table, which is what `audience="owner"` exists for.
 */
export default async function OwnerNotificationsPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const notifications = await fetchNotifications(supabase).catch(() => []);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <NotificationList initial={notifications} now={new Date()} audience="owner" />
      <p className="text-caption-sm text-muted mt-lg">
        These are addressed to you, not to one salon — every salon you run reports here.
      </p>
    </div>
  );
}
