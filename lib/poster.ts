import { formatMinutes12, minutesOfDay } from "./time";
import type { WorkingHour } from "./types/booking";
import { type Business, type BusinessType, isListed } from "./types/salon";

/**
 * The two strings the printed poster needs that no existing helper produces.
 *
 * The design (`Tho QR Poster.dc.html`) has a tagline under the salon name and an "Open"
 * column beside the phone number, both filled with placeholder copy — *"Hair · Beauty ·
 * Care"* and *"Mon–Sat, 9:00–19:00"*. These turn them into facts about the actual salon,
 * which is the difference between a template and a poster somebody can put on a wall.
 *
 * Pure, in `lib/`, and tested — per AGENTS.md's rule about helpers never living beside a
 * component that might become a client one.
 */

/**
 * The rule under the salon's name, from what the shop actually is.
 *
 * The design's placeholder is the `salon` case, kept verbatim so the common salon prints
 * exactly what was drawn. The other three exist because the same poster is printed by a
 * barber and by somebody working out of their own front room, and *"Hair · Beauty · Care"*
 * is wrong for both — a mobile stylist has no premises for a customer to walk into, which
 * is the one thing a poster in a window is implicitly promising.
 */
const TAGLINES: Record<BusinessType, string> = {
  salon: "Hair · Beauty · Care",
  barber: "Cuts · Shaves · Grooming",
  home_based: "Hair · Beauty · By appointment",
  mobile: "Hair · Beauty · We come to you",
};

export function posterTagline(type: BusinessType): string {
  return TAGLINES[type] ?? TAGLINES.salon;
}

/** Monday first — a poster reads as a week, not as a database column. `dayOfWeek` is 0=Sun. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const SHORT_DAY: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

/**
 * `"09:00:00"` → `"9:00 am"`, through the shared formatter.
 *
 * **`formatMinutes12` in `lib/time.ts` is the one implementation**, and this is only the
 * adaptor from a `time` column to the minutes it takes. An earlier version of this file
 * carried its own copy of the same arithmetic, which is exactly the duplication AGENTS.md's
 * "keep them in step" rule exists to prevent — and it would have drifted the moment either
 * side changed, since both are ports of the same `hours_model.dart:46`.
 *
 * ## This is a surface where 12-hour is right, and that needs saying
 *
 * AGENTS.md records a standing divergence: `lib/hours.ts` is 24-hour where the Dart has
 * `formatMinutes12`, because `<input type="time">` reads and writes 24-hour and a gap pill
 * saying "1:00 pm" beside an input saying "13:00" would be worse than diverging from the mock.
 *
 * **That reasoning is about the editor, and this is print.** Nothing here sits beside a time
 * input; it is read by a customer standing in front of a shop, so the app's own 12-hour form
 * is the correct one — a *return* to upstream rather than a second divergence from it.
 *
 * `24:00:00` is a valid Postgres time and the hours editor can write it. The shared
 * formatter's `% 24` maps it to `12:00 am` — midnight, which is what it means.
 */
function short(time: string): string {
  return formatMinutes12(minutesOfDay(time));
}

/**
 * *"Mon–Sat, 9:00 am – 7:00 pm"* — the longest run of consecutive days that genuinely share hours.
 *
 * **It states a true thing rather than a complete one, and that is the deliberate trade.**
 * A salon can have a different Saturday, a lunch break, or a Wednesday half-day, and the
 * design gives this one line of about twenty characters. Three ways to fill it were possible:
 *
 * - Average or span the week — produces a line that is *false* on at least one day, which on
 *   a poster is somebody driving to a shut shop.
 * - Print all seven days — does not fit, and is not what was drawn.
 * - **Print the largest block of days that agree**, labelled with exactly those days. This is
 *   always true; it is only ever incomplete, and a customer who reads *"Mon–Fri, 9:00 am – 7:00 pm"*
 *   learns nothing false about Saturday.
 *
 * The third is what this does. A salon whose week is entirely irregular therefore prints a
 * single day (*"Wed, 9:00 am – 5:00 pm"*), which is honest and a signal to the owner that the poster
 * cannot summarise them — better than a confident wrong range.
 *
 * A day's span is its **earliest open to its latest close**, so a lunch break is absorbed.
 * That mirrors what `todayHoursLine` refuses to do for the salon page, and the reason it is
 * right here and wrong there is the audience: this is "roughly when we are open" on a wall,
 * not "can I come now" on a phone.
 *
 * Null when the salon has no hours at all — the caller drops the whole column rather than
 * printing an empty label.
 */
export function posterHoursLine(hours: WorkingHour[]): string | null {
  // Each day's outer span, keyed by day number.
  const span = new Map<number, string>();
  for (const day of WEEK_ORDER) {
    const rows = hours.filter((h) => h.dayOfWeek === day);
    if (rows.length === 0) continue;
    const open = rows.reduce((a, b) => (a.startTime <= b.startTime ? a : b)).startTime;
    const close = rows.reduce((a, b) => (a.endTime >= b.endTime ? a : b)).endTime;
    span.set(day, `${short(open)} – ${short(close)}`);
  }
  if (span.size === 0) return null;

  // Longest run of consecutive open days sharing one span. Ties keep the earliest, which is
  // why this is `>` rather than `>=` — Monday beats Thursday when both run three days.
  let best: { days: number[]; text: string } | null = null;
  let run: number[] = [];
  let runText: string | null = null;

  const flush = () => {
    if (runText && (best === null || run.length > best.days.length)) {
      best = { days: [...run], text: runText };
    }
  };

  for (const day of WEEK_ORDER) {
    const text = span.get(day) ?? null;
    if (text !== null && text === runText) {
      run.push(day);
      continue;
    }
    flush();
    run = text === null ? [] : [day];
    runText = text;
  }
  flush();

  if (best === null) return null;
  const { days, text } = best as { days: number[]; text: string };

  const label =
    days.length === 1
      ? SHORT_DAY[days[0]!]
      : `${SHORT_DAY[days[0]!]}–${SHORT_DAY[days[days.length - 1]!]}`;
  return `${label}, ${text}`;
}


/**
 * Why this salon cannot have a poster, or null when it can.
 *
 * **Only what would make the destination a printed 404 disqualifies a salon — not the
 * walk-in queue.** That is the change: the poster used to require `runsQueue`, because its
 * only destination was the join form, so nine of the ten live salons could not be given a
 * code at all. `/q/<id>` is a hub now — book, shop, or take a place in the line if there is
 * one — so a salon needs nothing beyond being one a customer can actually reach.
 *
 * **`isListed` is the authority**, not a second copy of its two conditions. It is the same
 * predicate every customer surface uses (`status === "approved" && isActive`), which is
 * exactly the point: if a poster could be printed for a salon Discover will not show, the
 * two would disagree about what "reachable" means. The branches below only *explain* a
 * refusal `isListed` has already made.
 *
 * The failure this prevents is invisible from the console: `businesses_select` requires
 * approval on its public branch, so an owner previewing their own poster sees a working page
 * while every customer who scans it gets "this page isn't here". `Highland Barbers` is a live
 * pending example, and it is the case most likely to be printed by accident precisely because
 * the owner cannot reproduce it from their own account.
 *
 * A code stuck to a counter cannot be reissued, so this runs before one is drawn rather than
 * after somebody has laminated it.
 */
export function posterBlockReason(
  b: Pick<Business, "status" | "isActive">,
): string | null {
  if (isListed(b)) return null;

  if (b.status === "pending") {
    return "This salon is still in review. Its poster appears here once it is approved — a code printed now would lead to a page customers cannot open.";
  }
  if (b.status === "rejected") {
    return "This salon was not approved, so its page is not public and a scan would find nothing.";
  }
  if (b.status === "suspended") {
    return "This salon is suspended, so its page is not public and a scan would find nothing.";
  }
  // Approved but switched off — the owner withdrew it themselves.
  return "This salon is switched off, so its page is hidden from customers.";
}
