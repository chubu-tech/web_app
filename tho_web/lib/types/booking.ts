/**
 * Booking-side types, ported from `tho/app/lib/data/models.dart`.
 *
 * Timestamps are `Date` in UTC. The DB hands back ISO strings; parse at the
 * edge in `lib/api/*` and keep `Date` everywhere above it, so no component ever
 * has to wonder whether a field is a string or a date.
 */

/** `public.booking_status` */
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

/** `public.booking_source` */
export type BookingSource = "app" | "walk_in" | "admin";

export type BookingItem = {
  id: string;
  serviceId: string | null;
  name: string;
  price: number;
  durationMinutes: number;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  startTs: Date;
  endTs: Date;
  totalPrice: number;
  source?: BookingSource;
  businessId?: string;
  businessName?: string | null;
  businessAddress?: string | null;
  businessCoverUrl?: string | null;
  staffMemberId?: string | null;
  staffName?: string | null;
  customerProfileId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAvatarUrl?: string | null;
  customerNote?: string | null;
  items?: BookingItem[];
  /**
   * Object **paths** in the private `booking-media` bucket — never URLs.
   *
   * Reference photos can be identifying, so the bucket is not world-readable;
   * resolve these through `signedBookingMediaUrls` at display time. Storing a public
   * URL here would defeat the bucket's whole point.
   */
  attachmentPaths?: string[];
  /**
   * The customer switched this booking's automatic reminders off — `bookings.reminders_muted`.
   *
   * **Server-owned**, which is the whole point: the app used to write
   * `reminder_<bookingId>` to `SharedPreferences`, where nothing read it back and it did not
   * follow you to another device. `private.enqueue_booking_reminders` now returns early on
   * this column, so it is honoured — and honoured across a reschedule too, which is the
   * regression `20260803000003` exists for.
   *
   * Note the polarity: the column stores **muted**, `set_booking_reminders` takes **enabled**.
   */
  remindersMuted?: boolean;
  /**
   * The salon's plan, carried so the reminder toggle can be hidden where reminders are not
   * enqueued at all. `private.enqueue_booking_reminders` returns early below growth.
   */
  businessPlan?: string | null;
};

/* --------------------------------------------------------------------------
   Derived reads, ported from the getters on `Booking` in
   `tho/app/lib/data/models.dart`. Kept as functions rather than fields so the
   mapper stays a straight row translation.
   -------------------------------------------------------------------------- */

/** A short human-facing code, e.g. `#A1B2C3D4`. */
export function bookingCode(b: Pick<Booking, "id">): string {
  return `#${b.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

/** The booked service ids, for re-running availability on a reschedule. */
export function serviceIds(b: Pick<Booking, "items">): string[] {
  return (b.items ?? [])
    .map((it) => it.serviceId)
    .filter((id): id is string => id != null);
}

/** "Haircut + Beard trim · 45 min" — the card's one-line summary. */
export function servicesSummary(b: Pick<Booking, "items">): string {
  const items = b.items ?? [];
  if (items.length === 0) return "Appointment";
  const names = items.map((it) => it.name).join(" + ");
  const minutes = items.reduce((sum, it) => sum + it.durationMinutes, 0);
  return minutes > 0 ? `${names} · ${minutes} min` : names;
}

export function hasNote(b: Pick<Booking, "customerNote">): boolean {
  return (b.customerNote ?? "").trim().length > 0;
}

/** Pending or confirmed — the two states a customer can still act on. */
export function isActive(b: Pick<Booking, "status">): boolean {
  return b.status === "pending" || b.status === "confirmed";
}

/**
 * Which tab a booking belongs in: 0 Upcoming · 1 Completed · 2 Cancelled.
 *
 * A direct port of `_tabOf` (`customer_home.dart:843`), including that it buckets by
 * **status, not by date** — so a confirmed booking whose time has passed but which
 * nobody has completed still reads as Upcoming. That is the honest answer: it is
 * still live as far as the salon is concerned.
 */
export function bookingTab(b: Pick<Booking, "status">): 0 | 1 | 2 {
  switch (b.status) {
    case "pending":
    case "confirmed":
      return 0;
    case "completed":
      return 1;
    default:
      return 2;
  }
}

/** A recorded payment against a booking, from the `payments` table. */
export type Payment = {
  id: string;
  amountNu: number;
  /** 'payment' | 'deposit' | 'refund' */
  kind: string;
  method: string;
  createdAt: Date;
};

/**
 * Whatever is still owed after deposits and refunds.
 *
 * Clamped at zero — an overpayment is the salon's to settle, not a negative number
 * on a customer's receipt (`booking_detail_screen.dart:448`).
 */
export function outstandingNu(totalPrice: number, payments: Payment[]): number {
  const paid = payments.reduce(
    (sum, p) => sum + (p.kind === "refund" ? -p.amountNu : p.amountNu),
    0,
  );
  const total = Math.round(totalPrice);
  return Math.min(Math.max(total - paid, 0), total);
}

/**
 * A row of `business_hours` or a staff member's weekly hours.
 *
 * `dayOfWeek` is 0=Sunday. `startTime`/`endTime` are `HH:MM:SS` wall-clock in
 * Thimphu — not instants. A lunch break is the *gap* between two segments on the
 * same day, not a stored field.
 */
export type WorkingHour = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

/** One bookable slot from `compute_availability`. */
export type Slot = {
  start: Date;
  end: Date;
};
