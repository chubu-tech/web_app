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
  /**
   * The copy the **server** composed for this row — `notifications.title` and `.body`.
   *
   * Added by `20260807000020` and filled on every insert path by the BEFORE INSERT trigger in
   * `20260807000021`. Measured on the live database: **all 92 rows carry both**, and the SQL
   * branches on audience, so a `booking_created` reads *"Booking confirmed / Your appointment
   * is set for Fri 7 Aug, 09:00"* for the customer and *"New booking / A customer booked Fri 7
   * Aug, 09:00"* for the salon.
   *
   * That invalidated this file's original premise. The old note here said the payload is *"not
   * a rendered message"* and that the app looks for a `payload.message` key the server never
   * writes — both true when written, and the conclusion drawn from them was to compose the
   * words client-side in `notification-copy.ts`. The server does it now, in one place, for
   * every client and every channel, so **the row's own words win** and the local composer is
   * the fallback. See `notificationText`.
   *
   * Nullable because the columns are, and because a row written by a path that sets them
   * explicitly to null would otherwise render an empty heading.
   */
  title: string | null;
  body: string | null;
  createdAt: Date;
  readAt: Date | null;
  /** Set for booking-related events — the customer inbox's only deep link. */
  bookingId: string | null;
  /**
   * Set for `order_placed` / `order_ready` / `order_declined` / `order_cancelled`.
   *
   * **Both inboxes link it now.** The owner's has since 3c (`/business/orders/[id]`); the
   * customer's route arrived in 2f, and this comment claimed otherwise for long enough that
   * *"your order is ready for pickup"* had nothing to press.
   */
  orderId: string | null;
};

export function isUnread(n: Pick<AppNotification, "readAt">): boolean {
  return n.readAt == null;
}
