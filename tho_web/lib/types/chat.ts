/**
 * Customer↔salon chat, ported from `tho/app/lib/data/models.dart:331-408`.
 *
 * One conversation per customer per salon, with a read timestamp for **each side** —
 * which is what makes "unread" a question with two answers. See `lib/chat-logic.ts`.
 */

export type Conversation = {
  id: string;
  businessId: string;
  customerProfileId: string;
  /** A snapshot taken when the thread was opened; the profile's own name wins over it. */
  customerName: string | null;
  /** Only when the read joined `businesses(name, cover_url)`. */
  businessName: string | null;
  businessCoverUrl: string | null;
  /** Maintained by `private.touch_conversation` on every message insert. */
  lastMessage: string | null;
  lastMessageAt: Date | null;
  /** When each side last opened the thread. Null means never. */
  customerLastReadAt: Date | null;
  businessLastReadAt: Date | null;
};

export type Message = {
  id: string;
  senderProfileId: string;
  body: string;
  createdAt: Date;
};

/**
 * The starting points offered above an empty composer, verbatim from
 * `chat_thread_screen.dart:116` — the app has a separate set for the salon's side, which
 * this app never shows.
 */
export const QUICK_REPLIES: readonly string[] = [
  "Are you open now?",
  "Do you have a slot today?",
  "How long is the wait?",
  "How much for a haircut?",
];
