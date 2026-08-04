import { describe, expect, it } from "vitest";
import {
  matchesFilter,
  NOTIFICATION_FILTERS,
  notificationStyle,
  notificationText,
  ownerNotificationText,
  type NotificationFilter,
} from "./notification-copy";
import type { AppNotification } from "./types/notification";

/**
 * Ported from `../tho/app/test/notifications_screen_test.dart`'s `notificationStyleFor`
 * and `filters` groups, plus cases the Dart has no equivalent of: the composed bodies
 * (which the app never shows) and **the no-show hole** (which the app gets wrong).
 *
 * The style chain is order-sensitive `contains` matching, so these tests are pinning a
 * *sequence*, not a lookup. Any reordering that keeps them green is safe; one that
 * breaks them is a behaviour change.
 */

const item = (
  eventType: string,
  { read = false }: { read?: boolean } = {},
): Pick<AppNotification, "eventType" | "readAt"> => ({
  eventType,
  readAt: read ? new Date() : null,
});

describe("notificationStyle", () => {
  it("does not style a cancellation like a confirmation", () => {
    const cancelled = notificationStyle("booking_cancelled");
    const confirmed = notificationStyle("booking_confirmed");
    expect(cancelled.accent).toBe("error");
    expect(confirmed.accent).toBe("success");
    expect(cancelled.icon).not.toBe(confirmed.icon);
  });

  it("lets a reminder beat the generic booking match", () => {
    // 'booking_reminder' contains both 'book' and 'remind'. The specific rule has to
    // win or every reminder reads as a fresh confirmation.
    const s = notificationStyle("booking_reminder");
    expect(s.kind).toBe("reminder");
    expect(s.title).toBe("Appointment reminder");
  });

  /**
   * The bug this pass exists to fix. `booking_no_show` contains **"book"**, so in the
   * Flutter app it falls through to the `['confirm','creat','book']` branch and a missed
   * appointment is announced as "Appointment confirmed!" over a green tick. Two such rows
   * are live for the seeded customer.
   */
  it("does not read a no-show as a confirmation", () => {
    const s = notificationStyle("booking_no_show");
    expect(s.kind).toBe("booking");
    expect(s.accent).toBe("error");
    expect(s.title).toBe("Missed appointment");
    expect(s.accent).not.toBe(notificationStyle("booking_confirmed").accent);
    expect(s.icon).not.toBe("success");
    expect(s.icon).not.toBe("bookingConfirmed");
  });

  it("catches the other spellings of a no-show", () => {
    for (const e of ["booking_no_show", "booking-no-show", "noshow_alert"]) {
      expect(notificationStyle(e).title, e).toBe("Missed appointment");
    }
  });

  it("gives queue, loyalty and order their own kinds", () => {
    expect(notificationStyle("queue_your_turn").kind).toBe("queue");
    expect(notificationStyle("loyalty_redemption_requested").kind).toBe("loyalty");
    expect(notificationStyle("order_placed").kind).toBe("order");
  });

  it("humanises an unknown event rather than showing a raw slug", () => {
    const s = notificationStyle("some_new_thing");
    expect(s.title).toBe("Some new thing");
    expect(s.kind).toBe("other");
  });

  it("still produces a usable title for an empty event type", () => {
    expect(notificationStyle("").title).toBe("Notification");
  });

  it("styles every event type the live data actually carries", () => {
    // The nine types present in `notifications` for the seeded customer. None may
    // land in `other` — that would mean the inbox shows a slug for a real event.
    const live = [
      "review_request",
      "booking_created",
      "booking_reminder",
      "queue_your_turn",
      "booking_cancelled",
      "loyalty_points_earned",
      "booking_no_show",
      "order_ready",
      "booking_rescheduled",
    ];
    for (const e of live) {
      expect(notificationStyle(e).kind, e).not.toBe("other");
    }
  });
});

describe("notificationText", () => {
  // 07:00 UTC is 13:00 in Thimphu. The body must say 13:00, wherever the reader is.
  const startTs = "2026-08-07T07:00:00+00:00";

  it("puts the appointment time in the body, in Thimphu time", () => {
    const { title, body } = notificationText("booking_created", { start_ts: startTs });
    expect(title).toBe("Booking confirmed");
    expect(body).toContain("13:00");
    expect(body).toContain("Fri 7 Aug");
  });

  it("honours an explicit payload tz, as the worker does", () => {
    const { body } = notificationText("booking_reminder", {
      start_ts: startTs,
      tz: "UTC",
    });
    expect(body).toContain("07:00");
  });

  it("still reads as a sentence when start_ts is missing or junk", () => {
    expect(notificationText("booking_created", {}).body).toBe("Your appointment is set.");
    expect(notificationText("booking_created", { start_ts: "not-a-date" }).body).toBe(
      "Your appointment is set.",
    );
    expect(notificationText("booking_rescheduled", {}).body).toBe("Your appointment moved.");
  });

  it("reads a no-show as a miss, matching the worker and not the app", () => {
    const { title, body } = notificationText("booking_no_show", {});
    expect(title).toBe("Missed appointment");
    expect(body).toBe("You were marked as a no-show.");
    expect(title).not.toMatch(/confirmed/i);
  });

  it("interpolates points and balance", () => {
    expect(notificationText("loyalty_points_earned", { points: 10, balance: 20 }).body).toBe(
      "+10 points — 20 total.",
    );
    // No balance in the payload: the sentence still has to end.
    expect(notificationText("loyalty_points_earned", { points: 5 }).body).toBe("+5 points.");
    expect(notificationText("loyalty_points_earned", {}).body).toBe("+0 points.");
  });

  it("passes a decline reason through and copes without one", () => {
    expect(notificationText("order_declined", { reason: "out of stock" }).body).toBe(
      "Sorry — out of stock",
    );
    expect(notificationText("order_declined", {}).body).toBe("Your order was declined.");
  });

  it("gives every live event type a real body", () => {
    const live: [string, Record<string, unknown>][] = [
      ["review_request", {}],
      ["booking_created", { start_ts: startTs }],
      ["booking_reminder", { start_ts: startTs, reminder_kind: "2h" }],
      ["queue_your_turn", {}],
      ["booking_cancelled", { reason: "customer cancelled" }],
      ["loyalty_points_earned", { points: 10, balance: 20 }],
      ["booking_no_show", {}],
      ["order_ready", {}],
      ["booking_rescheduled", { start_ts: startTs }],
    ];
    for (const [event, payload] of live) {
      const { title, body } = notificationText(event, payload);
      expect(title.length, event).toBeGreaterThan(0);
      // The whole point of this module: no live row may render an empty body, which
      // is what the app's `payload.message` lookup produces for all of them.
      expect(body.length, event).toBeGreaterThan(0);
    }
  });

  it("falls back to the humanised title rather than a flat 'Update'", () => {
    const { title, body } = notificationText("some_new_thing", {});
    expect(title).toBe("Some new thing");
    expect(body).toBe("");
  });

  it("ignores a payload.message key, which the server never writes", () => {
    // Guards against reintroducing the app's lookup: composition must not be
    // short-circuited by a field that is absent in production.
    const { body } = notificationText("booking_created", {
      start_ts: startTs,
      message: "SHOULD NOT APPEAR",
    });
    expect(body).not.toContain("SHOULD NOT APPEAR");
  });
});

describe("filters", () => {
  const booking = item("booking_confirmed");
  const reminder = item("booking_reminder");
  const queue = item("queue_your_turn");
  const offer = item("promo_offer");
  const loyalty = item("loyalty_points_earned");
  const read = item("booking_confirmed", { read: true });

  it("gathers bookings, reminders and queue calls under Bookings", () => {
    for (const n of [booking, reminder, queue]) {
      expect(matchesFilter("bookings", n), n.eventType).toBe(true);
    }
    expect(matchesFilter("bookings", offer)).toBe(false);
  });

  it("gathers promotions and loyalty under Offers", () => {
    expect(matchesFilter("offers", offer)).toBe(true);
    expect(matchesFilter("offers", loyalty)).toBe(true);
    expect(matchesFilter("offers", booking)).toBe(false);
  });

  it("makes Unread exactly the unread ones", () => {
    expect(matchesFilter("unread", booking)).toBe(true);
    expect(matchesFilter("unread", read)).toBe(false);
  });

  it("makes All take everything", () => {
    for (const n of [booking, offer, read]) {
      expect(matchesFilter("all", n)).toBe(true);
    }
  });

  it("puts a no-show under Bookings, where someone would look for it", () => {
    expect(matchesFilter("bookings", item("booking_no_show"))).toBe(true);
  });

  it("exposes the four tabs in the app's order", () => {
    expect(NOTIFICATION_FILTERS.map((f) => f.id)).toEqual<NotificationFilter[]>([
      "all",
      "unread",
      "bookings",
      "offers",
    ]);
  });
});

describe("ownerNotificationText", () => {
  // Exactly what the live rows carry: `start_ts` and nothing else. `private.enqueue_*` never
  // writes a customer name, so the copy must not reach for one.
  const payload = { start_ts: "2026-08-07T03:30:00Z", tz: "Asia/Thimphu" };

  it("reads booking_created as news about somebody else, not about you", () => {
    // The same row, same payload — the customer is told their appointment is set.
    expect(notificationText("booking_created", payload).title).toBe("Booking confirmed");
    expect(notificationText("booking_created", payload).body).toMatch(/Your appointment is set/);

    const owner = ownerNotificationText("booking_created", payload);
    expect(owner.title).toBe("New booking");
    expect(owner.body).toContain("09:30");
    expect(owner.body).not.toMatch(/your/i);
  });

  it("claims nothing the payload cannot supply", () => {
    // The mistake this pins down is the one the module header criticises the Flutter app for:
    // rendering a key the server has never written. A name is never in the payload, so the body
    // points at the booking instead of naming somebody.
    const owner = ownerNotificationText("booking_created", payload);
    expect(owner.body).toBe("For Fri 7 Aug, 09:30. Open it to see who.");
    // Even a payload that *claims* to hold a name is ignored, so a future server change has to be
    // a deliberate one here rather than silently altering live copy.
    expect(ownerNotificationText("booking_created", { ...payload, customer_name: "Pema" }).body).toBe(
      owner.body,
    );
  });

  it("covers the two events the customer table cannot", () => {
    // `order_placed` and `order_cancelled` are addressed to the salon, so
    // `notificationText` has no case and falls through to a humanised slug with no body.
    expect(notificationText("order_placed").body).toBe("");
    expect(ownerNotificationText("order_placed").title).toBe("New product order");
    expect(ownerNotificationText("order_placed").body).toMatch(/mark it ready/);

    expect(ownerNotificationText("order_cancelled").title).toBe("Order cancelled");
    expect(ownerNotificationText("order_cancelled").body).toMatch(/before you got to it/);
  });

  it("uses the time when there is one and a plain sentence when there is not", () => {
    // `booking_cancelled` and `order_placed` arrive with an empty payload on live data.
    expect(ownerNotificationText("booking_cancelled", payload).body).toBe(
      "Fri 7 Aug, 09:30 is free again.",
    );
    expect(ownerNotificationText("booking_cancelled", {}).body).toBe("A booking was cancelled.");
    expect(ownerNotificationText("booking_no_show", {}).body).toBe("A no-show.");
  });

  it("restates a reminder as a diary entry, since it is somebody else's reminder", () => {
    const owner = ownerNotificationText("booking_reminder", payload);
    expect(owner.title).toBe("Coming up");
    expect(owner.body).toMatch(/^An appointment at /);
  });

  it("defers to the customer wording for an event it has never met", () => {
    // More likely a new customer-facing event that also copies the salon than something
    // wholly new — and the customer wording is at least a sentence.
    expect(ownerNotificationText("queue_your_turn")).toEqual(notificationText("queue_your_turn"));
    expect(ownerNotificationText("something_new").title).toBe("Something new");
  });
});
