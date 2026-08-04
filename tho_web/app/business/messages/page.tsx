import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { OwnerConversationList } from "@/components/owner/owner-conversation-list";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchOwnerConversations } from "@/lib/api/owner-back-office";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

/**
 * The salon's inbox — the owner half of the app's Messages tab.
 *
 * **Filtered on the active salon's `business_id`, and that filter is a correction, not a
 * convenience.** `conversations_select` OR-matches *customer or business member*, so
 * `Api.myConversations()` — which leans on RLS alone — hands a user who is both an owner and a
 * customer one merged list. `fetchMyConversations` filters on `customer_profile_id` to keep salon
 * threads out of a personal inbox; this filters on `business_id` to keep personal threads out of
 * the salon's, and to keep *other* salons' threads out too, since this owner runs nine.
 *
 * Live, that means the one thread belonging to another owner's salon can never appear here — the
 * leak this filter exists to prevent, and the thing verification checks.
 */
export default async function OwnerMessagesPage() {
  const { active, userId } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const conversations = await fetchOwnerConversations(supabase, active.id).catch(() => []);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-xs font-medium">Messages</h1>
      <p className="text-body-sm text-muted mb-lg">
        Customers asking about times, prices and anything else. {active.name} only — switch salons
        in the header for another.
      </p>

      {conversations.length === 0 ? (
        <EmptyState
          icon={Icons.chat}
          title="No messages yet"
          message="When a customer presses Message on your salon page, the thread lands here."
        />
      ) : (
        <OwnerConversationList
          conversations={conversations}
          viewerId={userId}
          now={new Date()}
        />
      )}
    </div>
  );
}
