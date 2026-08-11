import type { Metadata } from "next";
import Link from "next/link";
import { ConversationList } from "@/components/customer/conversation-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchMyConversations } from "@/lib/api/chat";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

/**
 * The customer's threads, ported from `tho/app/lib/chat/chat_list_screen.dart`.
 *
 * **Registered only** — `conversations_insert` and `messages_insert` both require
 * `private.is_real_user()`, so a guest can hold no thread and has nothing to list.
 */
export default async function MessagesPage() {
  const account = await getAccount();

  if (account.state !== "registered") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.chat}
          title="Messaging needs an account"
          message="Salons reply to a real person, so this is one of the few things a visitor can't do."
          action={
            <Link href={`/sign-${account.state === "guest" ? "up" : "in"}?next=/messages`}>
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
  const conversations = await fetchMyConversations(supabase, account.user.id);

  if (conversations.length === 0) {
    return (
      <Shell>
        <EmptyState
          icon={Icons.chat}
          title="No messages yet"
          message="Open a salon and press Message to ask about times, prices or anything else."
          action={
            <Link href="/">
              <Button variant="outlined">Browse salons</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  // See the notifications page: resolved here so the list stays pure.
  const now = new Date();

  return (
    <Shell>
      <ConversationList
        conversations={conversations}
        viewerId={account.user.id}
        now={now}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-lg font-medium">Messages</h1>
      {children}
    </div>
  );
}
