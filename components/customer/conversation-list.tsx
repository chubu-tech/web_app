import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Icons, IconSize } from "@/components/ui/icons";
import { isUnreadFor, relativeAge, threadPreview } from "@/lib/chat-logic";
import type { Conversation } from "@/lib/types/chat";
import { cn } from "@/lib/utils";

/**
 * The thread list, ported from `tho/app/lib/chat/chat_list_screen.dart`.
 *
 * **An unread thread is tinted and outlined in brand colour** with a heavier name, as the
 * app does — and "unread" is asked *for this reader*, because a conversation carries a
 * read timestamp per side. See `isUnreadFor`.
 *
 * A server component: nothing here changes without a navigation, and the list is one read.
 */
export function ConversationList({
  conversations,
  viewerId,
  now,
}: {
  conversations: Conversation[];
  viewerId: string;
  /** Handed in rather than read, so the ages cannot differ between two renders. */
  now: Date;
}) {
  return (
    <ul className="gap-sm flex flex-col">
      {conversations.map((c) => {
        const unread = isUnreadFor(c, viewerId);
        const preview = threadPreview(c);
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              className={cn(
                "p-base gap-md flex items-center rounded-md border",
                "transition-colors duration-[var(--duration-fast)]",
                unread
                  ? "border-rausch bg-surface-soft border-[1.4px]"
                  : "border-hairline bg-canvas hover:border-border-strong",
              )}
            >
              <Avatar
                name={c.businessName ?? "Salon"}
                photoUrl={c.businessCoverUrl}
                size={48}
                square
              />
              <span className="min-w-0 flex-1">
                <span className="gap-sm flex items-baseline justify-between">
                  <span
                    className={cn(
                      "text-title truncate",
                      unread ? "text-ink font-bold" : "text-ink font-medium",
                    )}
                  >
                    {c.businessName ?? "Salon"}
                  </span>
                  {c.lastMessageAt ? (
                    <time
                      dateTime={c.lastMessageAt.toISOString()}
                      className="text-caption-sm text-muted shrink-0 tabular-nums"
                    >
                      {relativeAge(c.lastMessageAt, now)}
                    </time>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-body-sm mt-xxs block truncate",
                    preview.empty
                      ? "text-muted-soft italic"
                      : unread
                        ? "text-ink"
                        : "text-muted",
                  )}
                >
                  {preview.text}
                </span>
              </span>
              {unread ? (
                <span aria-label="Unread" className="bg-rausch size-2 shrink-0 rounded-full" />
              ) : (
                <Icons.chevronRight
                  className="text-muted-soft shrink-0"
                  style={{ width: IconSize.xs, height: IconSize.xs }}
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
