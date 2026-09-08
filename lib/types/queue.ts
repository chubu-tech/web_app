/**
 * Walk-in queue types, ported from `tho/app/lib/data/models.dart:945-1057`.
 *
 * The line's *behaviour* — ordering, position, ETA, the pre-join projection —
 * lives in `lib/queue-logic.ts` beside its tests. This file is only the shape.
 */

/** `queue_entries.status` — a real Postgres enum (`public.queue_status`). */
export type QueueStatus = "waiting" | "serving" | "done" | "no_show" | "left";

const QUEUE_STATUSES: readonly QueueStatus[] = [
  "waiting",
  "serving",
  "done",
  "no_show",
  "left",
];

/**
 * Wire string → status. Anything unrecognised becomes `waiting`.
 *
 * That default is deliberate and matches the Dart: an unknown status must not
 * silently read as terminal, because a terminal entry stops the live view from
 * polling. Failing towards "still in line" keeps the screen watching.
 */
export function queueStatusFromWire(value: string | null | undefined): QueueStatus {
  return QUEUE_STATUSES.find((s) => s === value) ?? "waiting";
}

/** The two statuses that put someone in the shop's *active* line. */
export function isActiveQueueStatus(status: QueueStatus): boolean {
  return status === "waiting" || status === "serving";
}

export type QueueEntry = {
  id: string;
  businessId: string;
  /** Null means "Anyone" — whichever barber frees first. */
  staffMemberId: string | null;
  serviceId: string | null;
  /** Null for a walk-in the shop added manually at the counter. */
  customerProfileId: string | null;
  /** Set on check-in, linking this place in line to an appointment. */
  bookingId: string | null;
  customerName: string | null;
  status: QueueStatus;
  /**
   * The booked `start_ts`, set only on check-in. Its presence is what gives an
   * appointment priority over walk-ins that joined the line earlier.
   */
  priorityAt: Date | null;
  joinedAt: Date;
  /** The chosen service's length, or 20 when nothing was chosen. */
  serviceMinutes: number;
  /**
   * Minutes left on an **in-progress** service, computed server-side by
   * `queue_active_line` from `served_at` and floored at 0 for an overrun. Always
   * 0 for a waiting entry, and 0 on read paths that don't select the column —
   * none of which feed the ETA.
   */
  servingRemainingMinutes: number;
  /**
   * Seconds left on a **stepped-out hold**, or 0 when the guest is present.
   *
   * A hold keeps the entry — `joinedAt` and `priorityAt` are untouched — but sorts it
   * behind everyone present, so the person is *skipped* rather than removed and drops back
   * into their natural place the moment it lapses. Nothing reaps it;
   * `deferred_until > now()` simply stops being true.
   *
   * **Server-computed on the customer path** (`queue_active_line.deferred_secs_left`) for
   * the same reason `servingRemainingMinutes` is: the client sorts on this, and a device
   * clock running slow must not be able to move anyone's place in the line. On the owner
   * path it is derived from the raw `deferred_until` column, where the only clock involved
   * is the owner's own and `call_next` remains the authority on who is actually picked.
   */
  deferredSecondsLeft: number;
  /** Only when the read joined `businesses(name)`. */
  businessName: string | null;
  /**
   * The customer's phone and avatar — **only on the owner board's read.**
   *
   * `queue_active_line`, which is what a customer polls, returns a deliberately
   * PII-free projection, so both are null on that path. The owner board reads
   * `queue_entries` directly and joins `profiles`, which `profiles_select` permits
   * because a business member may read a customer who is *in their queue*. Null here
   * therefore means two different things depending on the read, and neither is an
   * error: unknown for a customer, absent for a walk-in the shop typed in by hand.
   */
  customerPhone: string | null;
  customerAvatarUrl: string | null;
};

/** Stepped out, with the hold still running. */
export function isDeferred(entry: Pick<QueueEntry, "deferredSecondsLeft">): boolean {
  return entry.deferredSecondsLeft > 0;
}

/**
 * Whole minutes left on a hold, **rounded up**, so one second left still reads "1 min"
 * rather than the "0 min" that looks like an expiry.
 */
export function deferredMinutesLeft(entry: Pick<QueueEntry, "deferredSecondsLeft">): number {
  return Math.ceil(entry.deferredSecondsLeft / 60);
}

/**
 * How long a step-out holds a place. `set_queue_deferral` clamps 0–60 server-side; this is
 * the one length the buttons offer, and it is the number in their labels.
 */
export const QUEUE_STEP_OUT_MINUTES = 10;

/**
 * Who to put on the board for this entry: their profile name, then the walk-in card's typed
 * name, then "Walk-in".
 *
 * `join_queue` records `customer_name` **only** for an entry a business member typed, so
 * reading it alone labels every customer who joined from an app as a walk-in — the barber
 * calling "Walk-in" to a line of people who had each given their name. The mapper already
 * folds the joined profile name in ahead of the typed one, so this is the last step of that
 * same rule rather than a second copy of it.
 */
export function queueDisplayName(entry: Pick<QueueEntry, "customerName">): string {
  const name = entry.customerName?.trim();
  return name && name.length > 0 ? name : "Walk-in";
}

/**
 * A projected place in line for someone who has **not** joined yet, and the
 * shop-level summary behind the wait badge. Both come out of `queue-logic.ts`.
 */
export type QueueProjection = { position: number; etaMinutes: number };
export type QueueShopSummary = { waiting: number; etaMinutes: number };

/**
 * Why a customer can or cannot take a place right now.
 *
 * Web-only, and a function rather than three conditionals in JSX so the rule is
 * testable on its own — every live salon is `anywhere`, so `needs_scan` has no
 * live example and unit tests are the only coverage it can get.
 */
export type QueueLockState = "open" | "needs_scan" | "unavailable";
