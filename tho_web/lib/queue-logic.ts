import {
  isActiveQueueStatus,
  type QueueEntry,
  type QueueLockState,
  type QueueProjection,
  type QueueShopSummary,
  type QueueStatus,
} from "./types/queue";
import { queueIsQrOnly, runsQueue, type Business } from "./types/salon";

/**
 * The walk-in line's arithmetic — a port of
 * `tho/app/lib/data/models.dart:1096-1322`, with its tests ported from
 * `tho/app/test/queue_logic_test.dart` case for case.
 *
 * **Keep the two suites in step.** These numbers are a promise made twice: the
 * join form projects a position and a wait *before* joining, and the live view
 * recomputes them a moment later. Both call the same functions here precisely so
 * one cannot contradict the other — a separately-derived preview is how a customer
 * gets told "#4 · ~45 min" and then shown "#6 · ~70 min".
 *
 * Everything is pure. The server owns the ordering; this only has to agree with it.
 */

/** Entries a specific barber will work through: theirs, plus the "Anyone" pool. */
export function orderedFor(staffId: string | null, all: QueueEntry[]): QueueEntry[] {
  return all
    .filter(
      (e) =>
        e.status === "waiting" && (e.staffMemberId === staffId || e.staffMemberId == null),
    )
    .sort(byPriorityThenFifo);
}

/**
 * Every waiting entry in the shop, in one order.
 *
 * Backs the "Anyone" case, where the customer is taken by whichever barber frees
 * first — so every waiting head counts, not just the unassigned pool.
 */
export function orderedShopWide(all: QueueEntry[]): QueueEntry[] {
  return all.filter((e) => e.status === "waiting").sort(byPriorityThenFifo);
}

/**
 * The server's ordering: checked-in appointments first by their booked start, then
 * walk-ins FIFO by join time. Mirrors `order by (priority_at is null), priority_at
 * nulls last, joined_at` in `private.queue_front`.
 *
 * Shared by both orderings above so a single barber's line and the shop-wide line
 * can never sort differently.
 */
function byPriorityThenFifo(a: QueueEntry, b: QueueEntry): number {
  const aPriority = a.priorityAt != null;
  const bPriority = b.priorityAt != null;
  if (aPriority !== bPriority) return aPriority ? -1 : 1;
  if (aPriority && bPriority) {
    const byPriority = a.priorityAt!.getTime() - b.priorityAt!.getTime();
    if (byPriority !== 0) return byPriority;
  }
  return a.joinedAt.getTime() - b.joinedAt.getTime();
}

/**
 * 1-based place in line.
 *
 * **Which line depends on the choice.** A specific barber counts that barber's
 * own-or-Anyone queue; **no preference counts the whole shop**. Before that
 * distinction existed the form could read "1 waiting · ~22 min" directly above
 * "You'd be #1 · ~22 min" while someone was plainly ahead — the badge was already
 * shop-wide and the position was not.
 */
export function positionOf(entry: QueueEntry, all: QueueEntry[]): number {
  const line =
    entry.staffMemberId != null ? orderedFor(entry.staffMemberId, all) : orderedShopWide(all);
  return line.findIndex((x) => x.id === entry.id) + 1;
}

/**
 * Minutes still owed on whatever is in the chair in `staffId`'s line.
 *
 * `orderedFor` filters `serving` rows out, so without this the front of the queue
 * reads "~0 min" through a 40-minute colour. The null-staff branch mirrors
 * `orderedFor`'s visibility rule defensively — `call_next` stamps
 * `staff_member_id = coalesce(staff_member_id, p_staff)`, so an unassigned
 * `serving` row should not occur.
 */
function servingMinutesFor(staffId: string | null, all: QueueEntry[]): number {
  return all
    .filter((e) => e.status === "serving" && (e.staffMemberId === staffId || e.staffMemberId == null))
    .reduce((sum, e) => sum + e.servingRemainingMinutes, 0);
}

/**
 * Minutes of work ahead of `id` inside an **already ordered** line. 0 when `id`
 * leads it or isn't in it. Shared by both branches of `etaMinutesFor` so the
 * "ahead" rule can only change in one place.
 */
function minutesAhead(id: string, line: QueueEntry[]): number {
  const index = line.findIndex((x) => x.id === id);
  if (index <= 0) return 0;
  return line.slice(0, index).reduce((sum, x) => sum + x.serviceMinutes, 0);
}

/**
 * Minutes until this entry's turn.
 *
 * With a specific barber it is exact: the work ahead in that barber's line plus
 * the remainder of their current cut.
 *
 * With no preference the shop's remaining work is spread across the barbers
 * actually **working the line** — not `barberCount` on its own. `barberCount` is
 * the employed roster (`is_active`/`deleted_at` only); it says nothing about who is
 * on shift, and dividing by it understated the wait — the unsafe direction —
 * whenever some employed barbers weren't on the floor.
 *
 * So the divisor is the distinct barbers *represented* in the active line
 * (`serving` rows, plus `waiting` rows with a barber), with two cases:
 *
 * - **At least one represented** → that count, capped at `barberCount`. This is
 *   the partially-staffed shop the rule exists for.
 * - **None represented** → nobody is known to be busy, so nobody is presumed
 *   idle either: the whole roster divides. An idle 2-barber shop with unassigned
 *   walk-ins must divide by 2; flooring to 1 would overstate the common quiet case.
 *
 * `serving` short-circuits to 0 rather than falling through: the orderings exclude
 * the entry itself, but the serving-remainder sums below do not, so without this
 * guard someone already in the chair is quoted their own remaining cut as their wait.
 */
export function etaMinutesFor(
  entry: QueueEntry,
  all: QueueEntry[],
  { barberCount = 1 }: { barberCount?: number } = {},
): number {
  if (entry.status !== "waiting") return 0;

  if (entry.staffMemberId != null) {
    const line = orderedFor(entry.staffMemberId, all);
    return minutesAhead(entry.id, line) + servingMinutesFor(entry.staffMemberId, all);
  }

  const line = orderedShopWide(all);
  const ahead = minutesAhead(entry.id, line);
  const serving = all
    .filter((x) => x.status === "serving")
    .reduce((sum, x) => sum + x.servingRemainingMinutes, 0);

  const rosterCap = barberCount < 1 ? 1 : barberCount;
  const barbersInLine = new Set(
    all
      .filter((x) => x.staffMemberId != null && isActiveQueueStatus(x.status))
      .map((x) => x.staffMemberId!),
  );
  const divisor =
    barbersInLine.size === 0
      ? rosterCap
      : Math.min(Math.max(barbersInLine.size, 1), rosterCap);

  // Integer ceiling — a wait is never rounded down.
  return Math.ceil((ahead + serving) / divisor);
}

/**
 * The id of the synthetic entry `queuePreview` appends. Never a server-issued
 * uuid, so it cannot collide with a real row.
 */
export const QUEUE_PREVIEW_GHOST_ID = "__queue_preview_ghost__";

/**
 * Position and wait for someone who has **not** joined — the "You'd be #4 · ~45
 * min" line in the join form.
 *
 * It works by appending a ghost entry and running the very same `positionOf` /
 * `etaMinutesFor` the live view runs a moment later. That is the point: it cannot
 * promise a figure the next screen contradicts.
 *
 * **The ghost's sort key comes from the line, not from the clock.** Real
 * `joinedAt` values are stamped by the server (`joined_at`'s column default), so a
 * ghost keyed off the browser clock sorts ahead of a real walk-in whenever the
 * device lags the server by more than the age of the newest waiting entry — and
 * under-promises the wait. Instead the ghost is defined to sort last among FIFO
 * walk-ins: one second after the latest `joinedAt` in the line, or a far-future
 * sentinel when the line is empty. Priority entries are untouched, since
 * `byPriorityThenFifo` puts them first regardless of join time.
 */
export function queuePreview({
  staffId,
  serviceMinutes,
  line,
  barberCount,
}: {
  staffId: string | null;
  serviceMinutes: number;
  line: QueueEntry[];
  barberCount: number;
}): QueueProjection {
  const latestJoin = line.reduce<number | null>(
    (max, e) => (max == null || e.joinedAt.getTime() > max ? e.joinedAt.getTime() : max),
    null,
  );
  const ghostJoinedAt =
    latestJoin == null ? new Date(Date.UTC(2100, 0, 1)) : new Date(latestJoin + 1000);

  const ghost: QueueEntry = {
    id: QUEUE_PREVIEW_GHOST_ID,
    businessId: line[0]?.businessId ?? "",
    staffMemberId: staffId,
    serviceId: null,
    customerProfileId: null,
    bookingId: null,
    customerName: null,
    status: "waiting",
    priorityAt: null,
    joinedAt: ghostJoinedAt,
    serviceMinutes,
    servingRemainingMinutes: 0,
    businessName: null,
  };

  const withGhost = [...line, ghost];
  return {
    position: positionOf(ghost, withGhost),
    etaMinutes: etaMinutesFor(ghost, withGhost, { barberCount }),
  };
}

/**
 * The shop-level figures behind the wait badge: heads waiting, and what someone
 * walking in right now with no barber preference would wait.
 *
 * The zero-minute service excludes the asker's own cut — this is the wait to be
 * *seated*, not to be finished.
 */
export function queueShopSummary({
  line,
  barberCount,
}: {
  line: QueueEntry[];
  barberCount: number;
}): QueueShopSummary {
  return {
    waiting: line.filter((e) => e.status === "waiting").length,
    etaMinutes: queuePreview({ staffId: null, serviceMinutes: 0, line, barberCount })
      .etaMinutes,
  };
}

/**
 * Legal owner transitions, mirroring the `set_queue_status` rules.
 *
 * Ported even though this app has no owner surface: the customer's view has to
 * agree with the transitions the server allows, and `done`/`no_show`/`left` being
 * terminal is what stops the live view polling forever.
 */
export function canOwnerQueueTransition(from: QueueStatus, to: QueueStatus): boolean {
  if (from === "serving") return to === "done" || to === "no_show";
  if (from === "waiting") return to === "no_show";
  return false;
}

/** A customer may leave only while still waiting — `leave_queue` enforces it too. */
export function canCustomerLeave(from: QueueStatus): boolean {
  return from === "waiting";
}

/** True once the entry has dropped out of the shop's active line for good. */
export function isTerminal(status: QueueStatus): boolean {
  return !isActiveQueueStatus(status);
}

/**
 * Whether this salon will take a place in line from this caller, right now.
 *
 * `unavailable` covers both halves of the gate — the plan and the owner's switch —
 * because an entitled salon that turned its queue off must not advertise a line
 * `join_queue` would refuse.
 *
 * `needs_scan` is **not** a failure: it is an instruction the customer can act on
 * by walking up to the counter, and it must not be phrased like the other one.
 */
export function queueLockState(
  business: Pick<Business, "plan" | "queueEnabled" | "queueJoinMode">,
  viaQr: boolean,
): QueueLockState {
  if (!runsQueue(business)) return "unavailable";
  if (queueIsQrOnly(business) && !viaQr) return "needs_scan";
  return "open";
}
