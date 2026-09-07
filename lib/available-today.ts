import { kmTo, type Coords } from "./discover-logic";
import { queueShopSummary } from "./queue-logic";
import { timeLabel } from "./clock";
import type { Business, SalonAvailability } from "./types/salon";

/**
 * "Available today" — which salons can see somebody before the day is out, soonest first.
 *
 * A port of `AvailableTodayRow.available` and `.labelFor`
 * (`../tho/app/lib/customer/home_sections.dart:747-829`), added upstream on 2026-08-08
 * together with the `salons_available_today` RPC that feeds it.
 *
 * **The row answers a different question from every other row on Discover.** Recommended,
 * Nearby and Top rated all rank salons by what they *are*; this one ranks them by when they
 * can take you, which is the question somebody standing on the street at four o'clock is
 * actually asking. That is why it is worth a server round trip of its own.
 */

/** A salon with the soonest thing it can offer today, and how far away it is. */
export type AvailableSalon = {
  business: Business;
  /** The soonest bookable start left today, or null when only a walk-in is on offer. */
  slot: Date | null;
  /** Minutes to be *seated* as a walk-in, or null when the salon runs no line. */
  waitMinutes: number | null;
  /** Straight-line distance, or null with no fix and no coordinates. */
  km: number | null;
};

/**
 * Minutes from `now` until this salon could see you.
 *
 * A booked slot and a walk-in wait are **compared directly**, and that is the design
 * decision rather than a shortcut: a card reading "Today 14:30" sorting behind one reading
 * "Walk in · ~5 min" is an order the customer can account for, because both cards state
 * their own answer. Ranking the two on different scales would produce an order that looks
 * arbitrary on screen.
 *
 * A salon with neither is not sortable and never reaches here — {@link availableToday}
 * drops it.
 */
function minutesTo(s: AvailableSalon, now: Date): number {
  if (s.slot != null) return (s.slot.getTime() - now.getTime()) / 60_000;
  // The Dart uses `1 << 30`; any sentinel beyond a day's worth of minutes does the same
  // job, and Infinity cannot be mistaken for a real figure by a later reader.
  return s.waitMinutes ?? Number.POSITIVE_INFINITY;
}

/**
 * The salons that can see someone today, soonest first, distance as the tiebreak.
 *
 * Three rules, each of which the Dart states and each of which matters:
 *
 * - **An availability row with no matching business is dropped.** The RPC's moderation gate
 *   and the caller's own list are resolved independently, so a salon can be in one and not
 *   the other — a pending salon it declines to return, or one the caller filtered out by
 *   rating. Rendering an id with no salon behind it is not an option.
 * - **A salon offering neither a slot nor a live line is dropped.** A row that listed a
 *   salon with no answer would be the flat "All salons" list again, one section further up.
 * - **Unknown distance sorts last within its tie bucket, never as zero.** A salon with no
 *   coordinates is not nearby; treating null as 0 would float every unlocated salon to the
 *   top of every tie.
 *
 * The wait comes from `queueShopSummary`, which is also what the join sheet and the salon
 * page's badge use — see the note on {@link SalonAvailability} for why that matters.
 */
export function availableToday(
  all: Business[],
  availability: SalonAvailability[],
  { from, now, limit = 8 }: { from?: Coords | null; now: Date; limit?: number },
): AvailableSalon[] {
  const byId = new Map(all.map((b) => [b.id, b]));
  const out: AvailableSalon[] = [];

  for (const a of availability) {
    const business = byId.get(a.businessId);
    if (!business) continue;

    // Empty means "no walk-in answer" here — the RPC returns `[]` for a salon with the line
    // switched off, not only for one whose line happens to be empty. It used to mean "below
    // Growth" as well; `20260902000003_queue_for_all_plans.sql` removed that half.
    const waitMinutes =
      a.queueLine.length === 0
        ? null
        : queueShopSummary({ line: a.queueLine, barberCount: a.barberCount }).etaMinutes;

    if (a.nextSlot == null && waitMinutes == null) continue;

    out.push({
      business,
      slot: a.nextSlot,
      waitMinutes,
      km: from ? kmTo(business, from) : null,
    });
  }

  out.sort((x, y) => {
    const byTime = minutesTo(x, now) - minutesTo(y, now);
    if (byTime !== 0) return byTime;
    if (x.km == null) return y.km == null ? 0 : 1;
    if (y.km == null) return -1;
    return x.km - y.km;
  });

  return out.slice(0, limit);
}

/**
 * `Today 14:30` · `Walk in · ~15 min` · `Walk in · no wait`.
 *
 * **The slot is read in Thimphu time, not the viewer's.** It is a real instant, every salon
 * on Tho is in Bhutan, and a browser can be anywhere — the same divergence from the Dart
 * that `recommendations.ts` and `salon-copy.ts` already carry, and for the same reason. The
 * app reads it in Bhutan time too (`inBhutan`), so on this point the two agree; what
 * differs is that the app can assume the device is local and this cannot.
 */
export function availableLabel(s: Pick<AvailableSalon, "slot" | "waitMinutes">): string {
  if (s.slot != null) return `Today ${timeLabel(s.slot)}`;
  const wait = s.waitMinutes ?? 0;
  return wait <= 0 ? "Walk in · no wait" : `Walk in · ~${wait} min`;
}

/** How busy a salon is right now. */
export type SalonPresence = "open" | "packed" | "fullyBooked";

/**
 * A walk-in wait at or above this reads as "packed" rather than as a wait.
 *
 * Half an hour is the point where somebody standing in a Thimphu salon starts wondering
 * whether to try the shop next door — which is exactly the moment the card should have told
 * them before they walked over.
 */
export const PACKED_WAIT_MINUTES = 30;

/**
 * The state and the sentence for one salon, or `null` when the availability read says nothing
 * about it — a port of `../tho/app/lib/customer/salon_presence.dart`.
 *
 * **This exists because the product already knew the answer and only ever showed the happy
 * half of it.** `salons_available_today` returns the soonest bookable slot *and* the live
 * walk-in line for every salon in one round trip, and the only surface reading it was the
 * Available-today rail — which **drops** any salon with neither. So a salon with nothing left
 * today vanished from that rail and reappeared in the list below it looking exactly like one
 * with slots all afternoon. The customer found out by opening it, choosing a service,
 * choosing a stylist, and meeting an empty day.
 *
 * **Null rather than a guess**, and it is the most important branch here: this is one RPC over
 * every salon, so a salon missing from it — added mid-session, or the read failed — must show
 * **no badge at all**. A card claiming "Fully booked" because a network call was slow is worse
 * than a card claiming nothing.
 *
 * Pure, with no clock read and no data access, for the same reason `booking-guards.ts` is: the
 * rules are worth testing directly and the badge is presentation.
 */
export function presenceFor(
  a: SalonAvailability | null | undefined,
): { state: SalonPresence; label: string } | null {
  if (a == null) return null;

  const wait =
    a.queueLine.length === 0
      ? null
      // One estimator, shared with the join sheet, the salon page and the Available-today
      // rail. A second one here would let two surfaces quote different waits for one line.
      : queueShopSummary({ line: a.queueLine, barberCount: a.barberCount }).etaMinutes;

  // A bookable slot beats a queue: it is a time somebody can hold rather than a wait they
  // have to stand through.
  if (a.nextSlot != null) {
    return { state: "open", label: `Next ${timeLabel(a.nextSlot)}` };
  }
  if (wait != null) {
    if (wait >= PACKED_WAIT_MINUTES) {
      return { state: "packed", label: `Packed · ~${wait} min wait` };
    }
    return { state: "open", label: wait <= 0 ? "Walk in · no wait" : `Walk in · ~${wait} min` };
  }
  return { state: "fullyBooked", label: "Fully booked today" };
}

/** The same, keyed by business id — what a list of cards actually needs. */
export function presenceByBusiness(
  availability: readonly SalonAvailability[],
): Map<string, { state: SalonPresence; label: string }> {
  const out = new Map<string, { state: SalonPresence; label: string }>();
  for (const a of availability) {
    const p = presenceFor(a);
    if (p != null) out.set(a.businessId, p);
  }
  return out;
}
