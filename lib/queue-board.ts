import { orderedShopWide, queueShopSummary } from "./queue-logic";
import type { QueueEntry } from "./types/queue";
import type { StaffMember } from "./types/salon";

/**
 * The owner queue board's derived facts, as one value — a port of
 * `tho/app/lib/business/queue/queue_summary.dart`.
 *
 * The board answers four questions in order: *how bad is it · who is in a chair · who is
 * next · who can take them.* Before `queueBoardSummary` existed in the Dart, an owner had
 * to assemble all four by reading a card per barber and adding up, and no card answered the
 * first one at all.
 *
 * **Nothing is recomputed here.** Every ordering and estimate delegates to
 * `queue-logic.ts`, which the *customer's* wait badge also uses — so the figure an owner
 * quotes and the figure a customer is shown for the same line cannot disagree. That is the
 * single most important property of this file, and it is why it is a thin derivation rather
 * than its own arithmetic.
 *
 * Plain data plus two functions, rather than an object with methods: it keeps the summary
 * trivially inspectable in a test, and it means nothing here has to care whether it is
 * being built on a server or in a browser.
 */

export type QueueBoardSummary = {
  /** Heads currently waiting, shop-wide. */
  waiting: number;
  /**
   * What someone joining now with no barber preference would wait to be **seated** — the
   * same number `QueueWaitBadge` shows a customer for this line.
   */
  etaMinutes: number;
  /**
   * Active barbers with nobody in the chair, in roster order. The only ones a "Call next"
   * makes sense for.
   */
  freeBarbers: StaffMember[];
  /** The whole active roster, free or not. */
  totalBarbers: number;
  /**
   * Everyone mid-service. Normally at most one per barber; all are kept, because a server
   * race must not make a guest vanish from the board.
   */
  nowServing: QueueEntry[];
  /** One shop-wide waiting line, priority-then-FIFO — not a list per barber. */
  nextUp: QueueEntry[];
  /** Nothing waiting and nobody in a chair — the "walk straight in" state. */
  isQuiet: boolean;
  /** Staff id → display name, for resolving a row's barber. */
  barberNames: Record<string, string>;
  /** Minutes left across every service in progress. */
  servingRemainingMinutes: number;
};

/**
 * Derive the board from a live read.
 *
 * `entries` is `fetchBusinessQueue`'s output — every `waiting` or `serving` row — and
 * `staff` the active roster.
 */
export function queueBoardSummary(
  entries: QueueEntry[],
  staff: StaffMember[],
): QueueBoardSummary {
  const nowServing = entries.filter((e) => e.status === "serving");
  const busyIds = new Set(
    nowServing.map((e) => e.staffMemberId).filter((id): id is string => id != null),
  );

  // The ETA divisor is the **whole roster**, not just the idle barbers: a barber finishing
  // a cut is about to take someone, so counting only the free ones would double the quoted
  // wait the moment the shop got busy. `etaMinutesFor` narrows it further to the barbers
  // actually represented in the line, which is the partially-staffed case.
  const shop = queueShopSummary({
    line: entries,
    barberCount: staff.length === 0 ? 1 : staff.length,
  });

  return {
    waiting: shop.waiting,
    etaMinutes: shop.etaMinutes,
    freeBarbers: staff.filter((s) => !busyIds.has(s.id)),
    totalBarbers: staff.length,
    nowServing,
    nextUp: orderedShopWide(entries),
    isQuiet: shop.waiting === 0 && nowServing.length === 0,
    barberNames: Object.fromEntries(staff.map((s) => [s.id, s.displayName])),
    servingRemainingMinutes: nowServing.reduce(
      (sum, e) => sum + e.servingRemainingMinutes,
      0,
    ),
  };
}

/**
 * The barber's name for a row, or **"Anyone"**.
 *
 * "Anyone" covers two different situations on purpose: a guest who expressed no preference,
 * and an id that cannot be resolved. The board loads its roster in a separate read it
 * deliberately tolerates failing, and a raw UUID on screen would be worse than a label that
 * is slightly too generous.
 */
export function barberFor(summary: QueueBoardSummary, entry: QueueEntry): string {
  const id = entry.staffMemberId;
  if (id == null) return "Anyone";
  return summary.barberNames[id] ?? "Anyone";
}

/**
 * Minutes until the guest at zero-based `index` of `nextUp` sits down: whatever is left of
 * the cuts in progress, plus the services ahead of them.
 *
 * **Sums the line rather than dividing it, unlike `etaMinutes`** — and both are right for
 * their own question. `etaMinutes` answers "how long if I walk in now", where any barber
 * who frees up will do, so the shop's work spreads across the roster. This answers "when do
 * *I* sit down", and a named guest in a single ordered line waits for everyone ahead of
 * them.
 */
export function etaForPositionIn(summary: QueueBoardSummary, index: number): number {
  const ahead = summary.nextUp
    .slice(0, index)
    .reduce((sum, e) => sum + e.serviceMinutes, 0);
  return summary.servingRemainingMinutes + ahead;
}
