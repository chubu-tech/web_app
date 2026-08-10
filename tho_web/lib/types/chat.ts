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
  /**
   * The salon owner's profile id — **the customer's counterparty in this thread**, and so
   * the person they can report or block.
   *
   * Null when the projection did not select it, and also null when the salon is not
   * publicly readable: `businesses_select`'s public branch requires `status = 'approved'`,
   * so a pending salon's embed comes back empty and `businessName` is null for the same
   * reason. Either way the safety controls that need a person are absent rather than
   * pointed at nobody — an individual message can still be reported, which is what
   * `models.dart:367-372` says as well.
   */
  businessOwnerId: string | null;
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
