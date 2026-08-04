/**
 * The in-app notification inbox, over the delivery outbox.
 *
 * A row in `notifications` is both a *thing to send* and a *thing to show*. The
 * Edge Function reads it to send push or SMS and stamps the result; this app reads
 * the same row to show it in the inbox. So an item can be perfectly visible here
 * while its `status` records that nothing was ever delivered — which is, today,
 * every single row.
 */

/** What a notification is *about*, derived from its `event_type`. Drives icon and filter. */
export type NotificationKind =
  | "booking"
  | "reminder"
  | "offer"
  | "loyalty"
  | "order"
  | "queue"
  | "review"
  | "payment"
  | "other";

export type AppNotification = {
  id: string;
  eventType: string;
  /**
   * The event's own data — `start_ts`, `points`, `balance`, `reason`, `tz`.
   *
   * **Not a rendered message.** The Flutter app looks for a `payload.message` key
   * that the server never writes, which is why its inbox shows a bare title on
   * every live row. `notificationText` composes from these fields instead.
   */
  payload: Record<string, unknown>;
  createdAt: Date;
  readAt: Date | null;
  /** Set for booking-related events, and the only deep link the inbox has. */
  bookingId: string | null;
};

export function isUnread(n: Pick<AppNotification, "readAt">): boolean {
  return n.readAt == null;
}
