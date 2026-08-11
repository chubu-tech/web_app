import { kmTo, type Coords } from "./discover-logic";
import { queueShopSummary } from "./queue-logic";
import { THIMPHU_OFFSET_MIN } from "./time";
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

    // Empty means "no walk-in answer" here — the RPC returns `[]` for any salon below
    // Growth or with the line switched off, not only for a salon whose line is empty.
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
  if (s.slot != null) {
    const local = new Date(s.slot.getTime() + THIMPHU_OFFSET_MIN * 60_000);
    const hh = String(local.getUTCHours()).padStart(2, "0");
    const mm = String(local.getUTCMinutes()).padStart(2, "0");
    return `Today ${hh}:${mm}`;
  }
  const wait = s.waitMinutes ?? 0;
  return wait <= 0 ? "Walk in · no wait" : `Walk in · ~${wait} min`;
}
