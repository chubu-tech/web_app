import type { Conversation, Message } from "./types/chat";

/**
 * The chat rules that are worth stating once, ported from
 * `tho/app/lib/data/models.dart:364` and `chat_list_screen.dart`.
 */

/**
 * Whether this thread has something new **for a particular reader**.
 *
 * A conversation has two read timestamps, one per side, so "unread" has two answers and
 * the caller has to say who is asking. Which side the reader is on is decided by
 * `customerProfileId`, not by a role — the same person can be a customer of one salon and
 * a member of another.
 *
 * **A thread with no messages is never unread**, which the null `lastMessageAt` covers.
 * The Clock Tower Cuts thread was opened and never written in; a bold empty row would be
 * nonsense.
 *
 * **This is a pure timestamp comparison, and it cannot tell who wrote the last message** —
 * the conversation row denormalises `last_message` as text with no sender. So the rule
 * "your own message must not mark the thread unread for you" is **not enforced here**; it
 * is kept true by `mark_conversation_read` being called after a send, in
 * `components/customer/chat-thread.tsx`.
 *
 * That distinction is worth stating because getting it wrong is visible: the Dart original
 * claims the carve-out in its doc comment while implementing exactly this comparison, and
 * the result is that a thread you have just written into shows up bold with a badge of 1.
 * Verified against the live seed before the send path was fixed.
 */
export function isUnreadFor(
  conversation: Pick<
    Conversation,
    "customerProfileId" | "lastMessageAt" | "customerLastReadAt" | "businessLastReadAt"
  >,
  viewerProfileId: string | null,
): boolean {
  const last = conversation.lastMessageAt;
  if (last == null) return false;

  const viewerIsCustomer =
    viewerProfileId != null && viewerProfileId === conversation.customerProfileId;
  const seen = viewerIsCustomer
    ? conversation.customerLastReadAt
    : conversation.businessLastReadAt;

  return seen == null || last.getTime() > seen.getTime();
}

/** How many threads have something new for this reader — the badge on Chats. */
export function unreadThreadCount(
  conversations: Parameters<typeof isUnreadFor>[0][],
  viewerProfileId: string | null,
): number {
  return conversations.filter((c) => isUnreadFor(c, viewerProfileId)).length;
}

/** True when a message was written by the reader, so it sits on the right of the thread. */
export function isMine(message: Pick<Message, "senderProfileId">, viewerProfileId: string | null) {
  return viewerProfileId != null && message.senderProfileId === viewerProfileId;
}

/**
 * A one-line preview for the thread list.
 *
 * `lastMessage` is denormalised onto the conversation by
 * `private.touch_conversation`, so the list needs no join to the messages table. An
 * opened-but-empty thread says so rather than showing a blank line.
 */
export function threadPreview(
  conversation: Pick<Conversation, "lastMessage">,
): { text: string; empty: boolean } {
  const text = conversation.lastMessage?.trim();
  if (!text) return { text: "No messages yet", empty: true };
  return { text, empty: false };
}

/**
 * Compact relative age — `now`, `5m`, `3h`, `2d`, `4w` — ported from
 * `notifications_screen.dart:299` and shared with the inbox, which uses the same scale.
 *
 * `now` is a parameter so this is pure and testable; callers on a client component pass
 * their own render-time clock.
 */
export function relativeAge(then: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
