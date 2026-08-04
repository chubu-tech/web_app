import { THIMPHU_TZ } from "./time";
import { isUnread, type AppNotification, type NotificationKind } from "./types/notification";

/**
 * What a notification looks like and what it says.
 *
 * **Two systems in `../tho` disagree about this, and only one of them is right.**
 *
 * 1. `supabase/functions/process-notifications/index.ts:54`'s `compose()` switches
 *    **exactly** on `event_type` and returns a title *and* a body with the payload
 *    interpolated — "Your appointment is set for Fri 7 Aug, 09:00."
 * 2. `app/lib/notifications_screen.dart:41`'s `notificationStyleFor()` matches
 *    **loosely** with `contains`, and returns a title only.
 *
 * The second has a hole: `booking_no_show` matches none of its specific tests and
 * falls through to `['confirm','creat','book']` — because "booking_no_show" contains
 * **"book"** — so a missed appointment is announced as "Appointment confirmed!" over a
 * green tick. Two such rows are live right now.
 *
 * And the app renders `payload['message']`, a key the server has never written, so on
 * live data its rows carry a generic (sometimes wrong) title and nothing else — no
 * date, no salon, no points, though the payload holds all three.
 *
 * So: `notificationStyle` keeps the loose chain for **icon, accent and filter bucket**
 * with the no-show hole closed, and `notificationText` ports `compose()` for the words.
 * Neither invents copy — the bodies are the ones the product already sends.
 *
 * **Keep this in step with both originals.** If a new `event_type` appears in either,
 * it needs a case here and a test beside it.
 */

/**
 * The glyph, by **concept name** rather than by component.
 *
 * `lib/` stays free of `components/` — nothing else here imports a React module, and
 * this would have been the first. The list is a closed union, and the component that
 * renders it maps every member exhaustively, so a name with no glyph is a type error
 * rather than a blank square.
 */
export type NotificationIconName =
  | "bookingCancelled"
  | "bookingConfirmed"
  | "bookingRescheduled"
  | "notification"
  | "notificationActive"
  | "offer"
  | "payment"
  | "queue"
  | "reward"
  | "shopBag"
  | "star"
  | "success";

export type NotificationStyle = {
  icon: NotificationIconName;
  /** A short headline for the *class* of event. `notificationText` usually wins over it. */
  title: string;
  /** A token class for the accent colour — never a raw hex. */
  accent: "success" | "error" | "rausch" | "star" | "ink" | "muted";
  kind: NotificationKind;
};

/**
 * Event type → presentation.
 *
 * **Order is load-bearing.** Specific tests run before generic ones, so
 * `booking_reminder` reads as a reminder rather than a fresh confirmation, and
 * `booking_no_show` reads as a miss rather than a success. Every reordering here is a
 * behaviour change; the tests pin the sequence.
 */
export function notificationStyle(eventType: string): NotificationStyle {
  const e = eventType.toLowerCase();
  const has = (needles: string[]) => needles.some((n) => e.includes(n));

  if (has(["cancel"])) {
    return {
      icon: "bookingCancelled",
      title: "Booking cancelled",
      accent: "error",
      kind: "booking",
    };
  }
  if (has(["reschedul"])) {
    return {
      icon: "bookingRescheduled",
      title: "Booking rescheduled",
      accent: "rausch",
      kind: "booking",
    };
  }
  // **The fix.** Must precede the generic booking branch below, which would otherwise
  // claim `booking_no_show` on the substring "book" and call a miss a confirmation.
  if (has(["no_show", "no-show", "noshow"])) {
    return {
      icon: "bookingCancelled",
      title: "Missed appointment",
      accent: "error",
      kind: "booking",
    };
  }
  if (has(["remind", "nudge"])) {
    return {
      icon: "notificationActive",
      title: "Appointment reminder",
      accent: "rausch",
      kind: "reminder",
    };
  }
  if (has(["queue", "walk_in", "your_turn"])) {
    return { icon: "queue", title: "Walk-in queue", accent: "rausch", kind: "queue" };
  }
  if (has(["loyalty", "redemption", "points"])) {
    return { icon: "reward", title: "Loyalty reward", accent: "star", kind: "loyalty" };
  }
  if (has(["order"])) {
    return { icon: "shopBag", title: "Product order", accent: "ink", kind: "order" };
  }
  if (has(["offer", "promo", "discount"])) {
    return { icon: "offer", title: "An offer for you", accent: "star", kind: "offer" };
  }
  if (has(["review", "rating"])) {
    return { icon: "star", title: "Review requested", accent: "star", kind: "review" };
  }
  if (has(["pay", "card", "wallet", "deposit"])) {
    return { icon: "payment", title: "Payment update", accent: "success", kind: "payment" };
  }
  if (has(["complet"])) {
    return {
      icon: "success",
      title: "Appointment completed",
      accent: "success",
      kind: "booking",
    };
  }
  if (has(["confirm", "creat", "book"])) {
    return {
      icon: "bookingConfirmed",
      title: "Appointment confirmed",
      accent: "success",
      kind: "booking",
    };
  }

  return {
    icon: "notification",
    title: humanise(eventType),
    accent: "muted",
    kind: "other",
  };
}

/** An unrecognised event reads as a sentence, never as a raw slug. */
function humanise(eventType: string): string {
  const t = eventType.replaceAll("_", " ").trim();
  if (t.length === 0) return "Notification";
  return t[0]!.toUpperCase() + t.slice(1);
}

/**
 * The words, ported case for case from the delivery worker's `compose()`.
 *
 * **This is the copy the product already sends**, so an in-app row and the push or SMS
 * for the same event cannot say different things. Unknown events fall back to
 * `notificationStyle`'s humanised slug rather than the worker's flat "Update" — a
 * title is more use than a shrug, and the inbox has room for one.
 */
export function notificationText(
  eventType: string,
  payload: Record<string, unknown> = {},
): { title: string; body: string } {
  const when = formatWhen(payload.start_ts, tzOf(payload));

  switch (eventType) {
    case "booking_created":
      return {
        title: "Booking confirmed",
        body: when ? `Your appointment is set for ${when}.` : "Your appointment is set.",
      };
    case "booking_confirmed":
      return { title: "Booking confirmed", body: "Your appointment is confirmed." };
    case "booking_reminder":
      return {
        title: "Appointment reminder",
        body: when
          ? `Reminder: your appointment is at ${when}.`
          : "Reminder: you have an appointment coming up.",
      };
    case "booking_rescheduled":
      return {
        title: "Booking rescheduled",
        body: when ? `Your appointment moved to ${when}.` : "Your appointment moved.",
      };
    case "booking_cancelled":
      return { title: "Booking cancelled", body: "Your appointment was cancelled." };
    case "booking_no_show":
      return { title: "Missed appointment", body: "You were marked as a no-show." };
    case "booking_completed":
      return { title: "Appointment completed", body: "Thanks for coming in." };
    case "review_request":
      return { title: "How was your visit?", body: "Leave a review to help other customers." };
    case "loyalty_points_earned": {
      const points = numberOf(payload.points) ?? 0;
      const balance = numberOf(payload.balance);
      return {
        title: "You earned points",
        body: `+${points} points${balance != null ? ` — ${balance} total.` : "."}`,
      };
    }
    case "loyalty_reward_available":
      return {
        title: "Reward unlocked",
        body: `You have enough points for ${stringOf(payload.reward) ?? "a reward"}.`,
      };
    case "loyalty_redemption_confirmed":
      return {
        title: "Reward confirmed",
        body: `Enjoy your ${stringOf(payload.reward) ?? "reward"}!`,
      };
    case "order_ready":
      return {
        title: "Your order is ready",
        body: "Your order is ready for pickup — pay cash on collection.",
      };
    case "order_declined": {
      const reason = stringOf(payload.reason);
      return {
        title: "Order declined",
        body: reason ? `Sorry — ${reason}` : "Your order was declined.",
      };
    }
    case "queue_almost":
      return { title: "Almost your turn", body: "You're next up — please head to the shop." };
    case "queue_your_turn":
      return { title: "You're up now", body: "Your barber is ready for you." };
    case "rebooking_nudge": {
      const salon = stringOf(payload.business);
      return {
        title: "Time for your next visit?",
        body: salon ? `It's been a while since ${salon}.` : "It's been a while since your last visit.",
      };
    }
    // The worker also composes `loyalty_redemption_requested`, `order_placed` and
    // `order_cancelled`, but all three are addressed to the SALON, not the customer —
    // they can never reach this inbox. See `ownerNotificationText` for those.
    default:
      return { title: notificationStyle(eventType).title, body: "" };
  }
}

/**
 * The same events, in the **owner's** voice.
 *
 * **The audience decides the meaning, not the event type**, and this is the clearest case of it
 * in the whole product: `booking_created` reaching a customer is *"Booking confirmed — your
 * appointment is set for Fri 09:00"*, and reaching a salon it is *"New booking — Fri 09:00"*.
 * The same row, the same payload, opposite readings. So `notificationText` was not widened to
 * cover both; a second table is chosen by who is looking, and the two never have to compromise.
 *
 * Three of the owner's four live event types are shared with the customer's inbox
 * (`booking_created`, `booking_cancelled`, `booking_reminder`) and two are owner-only
 * (`order_placed`, `order_cancelled`) with **no case at all** in the customer table — they would
 * have fallen through to a humanised slug with an empty body. Those two are the ones the
 * `process-notifications` worker addresses to `business_owner_profile`.
 *
 * Unknown events defer to the customer table rather than to a slug: an event this list has not
 * met yet is more likely to be a new customer-facing one that also copies the salon than
 * something wholly new, and the customer wording is at least a sentence.
 *
 * ## What the payload actually holds
 *
 * **`start_ts` and nothing else, and often not even that.** Checked against the 27 live rows
 * addressed to this platform's one owner: `booking_created` carries `{"start_ts": …}`, and
 * `booking_cancelled` and `order_placed` carry `{}`. None of `private.enqueue_notification`,
 * `enqueue_order_notification`, `enqueue_queue_notification` or `enqueue_loyalty_notification`
 * writes a customer name at all.
 *
 * The first version of this function read `payload.customer_name` so a row could say *"New
 * booking — Pema, Fri 11:30"*. That name is never there — which is **the same mistake this
 * module's header criticises the Flutter app for**, where `notifications_screen.dart` renders
 * `payload['message']`, a key the server has never written. So the copy says only what the row
 * can support: who booked is one tap away on the booking itself, and a body that silently drops
 * half of its own sentence is worse than a short one.
 */
export function ownerNotificationText(
  eventType: string,
  payload: Record<string, unknown> = {},
): { title: string; body: string } {
  const when = formatWhen(payload.start_ts, tzOf(payload));

  switch (eventType) {
    case "booking_created":
      return {
        title: "New booking",
        body: when ? `For ${when}. Open it to see who.` : "Someone booked in.",
      };
    case "booking_confirmed":
      return {
        title: "Booking confirmed",
        body: when ? `For ${when}.` : "A booking was confirmed.",
      };
    case "booking_rescheduled":
      return { title: "Booking moved", body: when ? `Now ${when}.` : "A booking moved." };
    case "booking_cancelled":
      return {
        title: "Booking cancelled",
        body: when ? `${when} is free again.` : "A booking was cancelled.",
      };
    case "booking_no_show":
      return { title: "Marked no-show", body: when ? `${when} — nobody came.` : "A no-show." };
    case "booking_completed":
      return { title: "Booking completed", body: when ? `${when} is done.` : "A booking is done." };
    case "booking_reminder":
      // The worker sends reminders to the customer; a salon copy would be a reminder about
      // somebody else's appointment, so it is stated as the diary entry it is.
      return { title: "Coming up", body: when ? `An appointment at ${when}.` : "An appointment." };

    // ---- owner-only. Neither of these has a case in `notificationText`. --------
    case "order_placed":
      return {
        title: "New product order",
        body: "Someone has ordered — mark it ready when it's waiting for them.",
      };
    case "order_cancelled":
      return {
        title: "Order cancelled",
        body: "A customer cancelled their order before you got to it.",
      };
    case "loyalty_redemption_requested":
      return {
        title: "Reward claimed",
        body: `Someone wants to redeem ${stringOf(payload.reward) ?? "a reward"} — confirm it at the counter.`,
      };

    default:
      return notificationText(eventType, payload);
  }
}

/**
 * The event's own time, in Thimphu.
 *
 * The worker renders in the business's timezone rather than the runtime's, and every
 * business is `Asia/Thimphu`. Same reasoning as the rest of this app: match the
 * backend exactly rather than being general about a zone the product will never use.
 */
function formatWhen(startTs: unknown, timeZone: string): string {
  if (typeof startTs !== "string") return "";
  const d = new Date(startTs);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `payload.tz` wins if present, as it does in the worker — for a future multi-zone world. */
function tzOf(payload: Record<string, unknown>): string {
  return typeof payload.tz === "string" && payload.tz.length > 0 ? payload.tz : THIMPHU_TZ;
}

const numberOf = (v: unknown): number | null =>
  v == null || !Number.isFinite(Number(v)) ? null : Number(v);
const stringOf = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v : null;

/** The inbox's filter tabs. */
export type NotificationFilter = "all" | "unread" | "bookings" | "offers";

export const NOTIFICATION_FILTERS: readonly { id: NotificationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "bookings", label: "Bookings" },
  { id: "offers", label: "Offers" },
];

/**
 * Whether an item belongs in a tab.
 *
 * **Bookings deliberately includes reminders and queue calls**, and Offers includes
 * loyalty. From the reader's side those are all "something about my appointment" and
 * "something I might get", and splitting them finer leaves tabs holding one item.
 */
export function matchesFilter(
  filter: NotificationFilter,
  n: Pick<AppNotification, "eventType" | "readAt">,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unread":
      return isUnread(n);
    case "bookings": {
      const kind = notificationStyle(n.eventType).kind;
      return kind === "booking" || kind === "reminder" || kind === "queue";
    }
    case "offers": {
      const kind = notificationStyle(n.eventType).kind;
      return kind === "offer" || kind === "loyalty";
    }
  }
}
