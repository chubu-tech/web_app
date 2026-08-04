import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/customer/chat-thread";
import { HeroCircleButton } from "@/components/ui/detail-bits";
import { Icons } from "@/components/ui/icons";
import { fetchConversationById, fetchMessages } from "@/lib/api/chat";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Message",
  robots: { index: false, follow: false },
};

/**
 * One conversation.
 *
 * RLS scopes the read to a thread the caller belongs to, so a stranger's id is simply not
 * found — no ownership check needed here.
 *
 * **A salon member is turned away even though RLS would let them read**, because
 * `conversations_select` OR-matches the business side and this app has no owner surface:
 * a member landing here could read a customer's messages in a personal inbox and reply as
 * themselves with no indication of which side they were on. The owner console is Phase 3.
 */
export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount();
  if (account.state !== "registered") notFound();

  const supabase = await createClient();
  const conversation = await fetchConversationById(supabase, id);
  if (!conversation) notFound();
  if (conversation.customerProfileId !== account.user.id) notFound();

  const messages = await fetchMessages(supabase, id).catch(() => []);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <div className="gap-md mb-base flex items-center">
        <HeroCircleButton icon={Icons.back} label="Back to messages" href="/messages" />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-sm text-ink truncate font-semibold">
            {conversation.businessName ?? "Salon"}
          </h1>
          <Link
            href={`/salon/${conversation.businessId}`}
            className="text-body-sm text-rausch-cta font-medium underline"
          >
            View salon
          </Link>
        </div>
      </div>

      <ChatThread
        conversationId={conversation.id}
        viewerId={account.user.id}
        initial={messages}
      />
    </div>
  );
}
