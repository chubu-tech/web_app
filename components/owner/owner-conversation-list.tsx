import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Icons, IconSize } from "@/components/ui/icons";
import { isUnreadFor, relativeAge, threadPreview } from "@/lib/chat-logic";
import type { Conversation } from "@/lib/types/chat";
import { cn } from "@/lib/utils";

/**
 * The salon's message threads — the owner's side of
 * `tho/app/lib/chat/chat_list_screen.dart`, which the app renders embedded in a tab.
 *
 * **A separate component from `ConversationList`, not a parameterised one.** The two lists differ
 * in every particular that matters: the row's title (the customer's name here, the salon's name
 * there), the avatar it draws, the route it links to, and which side of `last_read_at` decides
 * unread. Three props to switch all of that would make one component that is two components with
 * a flag, and the flag would be the only documentation of why any of it differs.
 *
 * `isUnreadFor` needs no such switch: it already resolves the side from whether the viewer *is*
 * the customer, so an owner reading their own salon's thread gets `business_last_read_at`.
 *
 * **A thread with no messages is still a row.** Three of the five live ones are empty — a
 * customer opened a conversation and never typed. That is worth seeing: somebody meant to ask
 * something and stopped.
 */
export function OwnerConversationList({
  conversations,
  viewerId,
  now,
}: {
  conversations: Conversation[];
  viewerId: string;
  /** Handed in rather than read, so two renders cannot disagree about the ages. */
  now: Date;
}) {
  return (
    <ul className="gap-sm flex flex-col">
      {conversations.map((c) => {
        const unread = isUnreadFor(c, viewerId);
        const preview = threadPreview(c);
        // `customer_name` is snapshotted when the thread is opened, and one live row has none
        // at all — a guest who upgraded, or a profile with no name set.
        const name = c.customerName?.trim() || "Customer";
        return (
          <li key={c.id}>
            <Link
              href={`/business/messages/${c.id}`}
              className={cn(
                "p-base gap-md flex items-center rounded-md border",
                unread ? "border-rausch/40 bg-rausch/5" : "border-hairline-soft hover:bg-surface-soft",
              )}
            >
              <Avatar name={name} size={44} />
              <span className="min-w-0 flex-1">
                <span className="gap-sm flex items-baseline">
                  <span
                    className={cn(
                      "text-title text-ink min-w-0 flex-1 truncate",
                      unread ? "font-semibold" : "font-medium",
                    )}
                  >
                    {name}
                  </span>
                  {c.lastMessageAt ? (
                    <span className="text-caption-sm text-muted-soft shrink-0">
                      {relativeAge(c.lastMessageAt, now)}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-body-sm block truncate",
                    preview.empty ? "text-muted-soft italic" : unread ? "text-ink" : "text-muted",
                  )}
                >
                  {preview.text}
                </span>
              </span>
              {unread ? (
                <span className="bg-rausch size-2 shrink-0 rounded-full" aria-label="Unread" />
              ) : (
                <Icons.chevronRight
                  className="text-muted-soft shrink-0"
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
