import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/customer/chat-thread";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { HeroCircleButton } from "@/components/ui/detail-bits";
import { Icons } from "@/components/ui/icons";
import { fetchConversationById, fetchMessages } from "@/lib/api/chat";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Message" };

/**
 * One thread, from the salon's side.
 *
 * **`ChatThread` is reused as-is, from `components/customer/`.** It is genuinely the same widget:
 * it lists messages oldest-first, polls, sends as `auth.uid()`, and calls
 * `mark_conversation_read`, which decides *which side* to stamp from the caller's own id — so an
 * owner marking a thread read moves `business_last_read_at` and cannot clear the customer's
 * badge. Nothing in it knows or needs to know who is looking. The directory name is where it was
 * first needed, not a claim about who may use it.
 *
 * **The salon check is explicit.** `conversations_select` admits the customer *or* a business
 * member, so without it an owner could open a thread from a salon they merely bought from and
 * reply to it inside their own console under the salon's heading. The customer thread page makes
 * the mirror-image check for the mirror-image reason.
 *
 * And the id must belong to the **active** salon, not just to one of the nine: the header names
 * one salon, and a thread from a different one displayed under it would be a quiet lie about who
 * is replying.
 */
export default async function OwnerMessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { active, userId } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const { id } = await params;
  const supabase = await createClient();
  const conversation = await fetchConversationById(supabase, id);
  if (!conversation || conversation.businessId !== active.id) notFound();

  const messages = await fetchMessages(supabase, id).catch(() => []);
  const name = conversation.customerName?.trim() || "Customer";

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <div className="gap-md mb-base flex items-center">
        <HeroCircleButton
          icon={Icons.back}
          label="Back to messages"
          href="/business/messages"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-sm text-ink truncate font-semibold">{name}</h1>
          <p className="text-body-sm text-muted">Replying as {active.name}</p>
        </div>
      </div>

      <ChatThread conversationId={conversation.id} viewerId={userId} initial={messages} />
    </div>
  );
}
