/**
 * Booking-side types, ported from `tho/app/lib/data/models.dart`.
 *
 * Timestamps are `Date` in UTC. The DB hands back ISO strings; parse at the
 * edge in `lib/api/*` and keep `Date` everywhere above it, so no component ever
 * has to wonder whether a field is a string or a date.
 */

import { hasFeature } from "../entitlements";

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
 * Whether to offer the reminder switch on this booking at all.
 *
 * Three conditions, and it lives here rather than beside either surface that draws it so
 * `/bookings` and `/bookings/[id]` cannot disagree about when the control exists.
 *
 * - **Active**, because a reminder for a finished appointment is nothing.
 * - **A real customer.** `set_booking_reminders` raises `42501` when
 *   `customer_profile_id` is null, which is every walk-in — there is nobody to ask. Absent
 *   rather than present and doomed, the same rule Check in follows.
 * - **A plan that sends them.** `private.enqueue_booking_reminders` returns early below
 *   growth, so on a Basic salon the switch would save a genuine preference against something
 *   that never fires. Hidden rather than disabled with an apology: on most cards a
 *   permanently dead switch plus a line of negative copy is more noise than the control is
 *   worth, and a customer cannot upgrade someone else's salon anyway.
 *
 * **A null plan offers the switch.** That is not the same as Basic — it means the query did
 * not embed one, and `hasFeature` would read it as Basic and hide a working control. Since
 * `20260807000024_reminders_require_plan` the server refuses with P0001 if the guess was
 * wrong, and `ReminderToggle`'s revert path — built for exactly this, and until that
 * migration with nothing to catch — puts the switch back and says why. Same call as
 * `booking_rich_card.dart`'s `_remindersOffered`.
 */
export function canRemind(
  b: Pick<Booking, "status" | "customerProfileId" | "businessPlan">,
): boolean {
  if (!isActive(b) || b.customerProfileId == null) return false;
  if (b.businessPlan == null) return true;
  return hasFeature(b.businessPlan, "reminders");
}

/**
 * "Today" / "Tomorrow" / "In n days", or null beyond a week and for anything past.
 *
 * Compared as **Thimphu** calendar days, not the browser's: at 23:00 UTC it is already tomorrow
 * in Bhutan, and a card reading "Today" for an appointment that has moved to tomorrow is worse
 * than one that says nothing at all.
 *
 * **Moved here from `components/customer/booking-card.tsx`, where it read `new Date()` inside
 * the render.** Two reasons, both this repo's own rules: a pure helper belongs in `lib/` and not
 * beside a component that might become a client one (the `customerName` incident), and `now`
 * has to be an argument for the card and the detail page to be guaranteed to agree — two
 * renders reading their own clock eventually straddle midnight.
 */
export function relativeDayLabel(start: Date, now: Date): string | null {
  // Thimphu day index: shift by the offset, then floor to whole days.
  const dayIndex = (d: Date) => Math.floor((d.getTime() + 6 * 3_600_000) / 86_400_000);
  const days = dayIndex(start) - dayIndex(now);
  if (days < 0) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  return null;
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

/**
 * What to call the person on a booking — the app's `customerDisplayName`, fallbacks in its order:
 * the linked profile's name, then the name typed at the counter, then a label.
 *
 * `Walk-in` when the booking came from the counter and `Guest` otherwise: a booking always has
 * *someone*, and what varies is how much the salon knows about them.
 *
 * **This lived in `components/owner/owner-booking-card.tsx` and had to move.** That file became a
 * client component when the card grew its inline actions, and a `"use client"` module's exports
 * reach a server component as client *references* rather than as functions — so four server
 * surfaces that call this (`booking-detail.tsx`, both booking detail routes, `today-snapshot.tsx`)
 * started throwing at render. It is pure logic over a `Booking` and belongs here, where both sides
 * of the boundary can call it.
 */
export function customerName(b: Pick<Booking, "customerName" | "source">): string {
  return b.customerName ?? (b.source === "walk_in" ? "Walk-in" : "Guest");
}

/**
 * What a payment was — the four values `payments_kind_check` actually allows.
 *
 * **The old comment here named `'payment'`, which the constraint forbids, and omitted
 * `balance` and `full`, which it allows.** Read straight off the live CHECK:
 * `kind = any (array['deposit','balance','full','refund'])`. Nothing was visibly broken by it
 * — `payments` has **0 rows platform-wide**, so no label had ever rendered — but the receipt and
 * the owner's ledger were both built to a vocabulary the database does not have.
 */
export type PaymentKind = "deposit" | "balance" | "full" | "refund";

/** How it was taken — `payments_method_check`. `mbob` is mBoB, the Bank of Bhutan app. */
export type PaymentMethod = "cash" | "mbob" | "bank_transfer" | "other";

/** A recorded payment against a booking, from the `payments` table. */
export type Payment = {
  id: string;
  amountNu: number;
  kind: PaymentKind;
  method: PaymentMethod;
  createdAt: Date;
};

/**
 * What each `kind` is called on screen.
 *
 * `full` is *"Paid in full"* rather than "Full": these read in a list beside an amount, where a
 * bare adjective is not a thing that happened.
 */
export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Paid in full",
  refund: "Refund",
};

/**
 * `mbob` and `bank_transfer` are identifiers, not words anyone says.
 *
 * **Lower case, because these read mid-sentence** — `paymentLine` builds
 * *"Deposit · cash · 4 Aug"*. See {@link PAYMENT_METHOD_CHOICES} for the standalone form.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "cash",
  mbob: "mBoB",
  bank_transfer: "bank transfer",
  other: "other",
};

/**
 * The same four methods labelled for a **standalone control** — a chip, a radio, a heading.
 *
 * A second table rather than capitalising the first letter of the prose labels, and that is not
 * pedantry: `"mbob".charAt(0).toUpperCase()` yields **"MBoB"**, which is not the name of
 * anything. mBoB is the Bank of Bhutan's app and it is written that way everywhere including
 * `lib/plans.ts`. Caught by a verification run that looked for a chip reading "mBoB" and did
 * not find one.
 *
 * Ordered as the sheet offers them, cash first, because that is what a counter takes.
 */
export const PAYMENT_METHOD_CHOICES: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mbob", label: "mBoB" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

/**
 * "Deposit · cash · 4 Aug" — one payment as a line of prose.
 *
 * Here rather than in either component, because the customer's receipt and the salon's ledger
 * describe the *same row* and must not describe it differently. Unknown values fall through to
 * the raw string rather than to a guess: a `kind` this build has never heard of is more usefully
 * shown as itself than mislabelled as a payment.
 */
export function paymentLine(p: Payment, timeZone: string): string {
  const kind = PAYMENT_KIND_LABELS[p.kind] ?? p.kind;
  const method = PAYMENT_METHOD_LABELS[p.method] ?? p.method;
  const when = p.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone,
  });
  return `${kind} · ${method} · ${when}`;
}

/**
 * Whatever is still owed after deposits and refunds.
 *
 * Clamped at zero — an overpayment is the salon's to settle, not a negative number
 * on a customer's receipt (`booking_detail_screen.dart:448`).
 */
export function outstandingNu(totalPrice: number, payments: Payment[]): number {
  /*
    **The sign is already in the data.** This used to negate a `refund`'s amount, on the
    assumption that the table stores magnitudes and the kind carries the direction. It does
    not: `record_payment` writes a refund as a **negative** `amount_nu` — the RPC's own comment
    says so, and `booking_payments` sums the column raw to produce `total_paid`. So negating it
    here was a double negative, and a refund *increased* what the customer appeared to have
    paid.

    Measured, once a writer existed to produce the row: a Nu 1,200 booking with a Nu 400 deposit
    and a Nu 150 refund read **Outstanding Nu 650** where the signed sum is 250, so the true
    figure is 950. Nothing caught it for three slices because `payments` had no rows on any
    platform and the tests encoded the same wrong assumption as the code.

    `Math.abs` is deliberately *not* used: a refund arriving positive would be a row this
    product cannot create, and defending against it here would re-introduce the ambiguity
    rather than resolve it. One writer, one convention.
  */
  const paid = payments.reduce((sum, p) => sum + p.amountNu, 0);
  const total = Math.round(totalPrice);
  return Math.min(Math.max(total - paid, 0), total);
}

/**
 * What was taken **up front** — the deposits, net of refunds.
 *
 * Only `deposit` rows count, not everything paid: the figure exists to answer *"is there
 * money here the salon keeps if nobody turns up"*, and a balance handed over after the cut
 * is not no-show cover. That is the distinction the app's *"deposit retained as no-show
 * cover"* pill makes, and reading it off the total paid would name a number the entitlement
 * has nothing to do with.
 *
 * **Refunds net against it**, so a deposit taken and then given back reads as zero rather
 * than as cover the salon no longer holds. A refund is not itself tagged as refunding a
 * deposit — `payments` has no such link — so this is the honest approximation: everything
 * refunded on the booking comes off the deposits, and the result is clamped at zero.
 *
 * `Math.abs` on the refund, unlike {@link outstandingNu}, because this subtracts explicitly
 * rather than summing: the sign is being supplied by the arithmetic here, so taking the
 * magnitude is what keeps the two from cancelling out.
 */
export function depositNu(payments: Payment[]): number {
  const deposits = payments
    .filter((p) => p.kind === "deposit")
    .reduce((sum, p) => sum + p.amountNu, 0);
  const refunded = payments
    .filter((p) => p.kind === "refund")
    .reduce((sum, p) => sum + Math.abs(p.amountNu), 0);
  return Math.max(0, deposits - refunded);
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
