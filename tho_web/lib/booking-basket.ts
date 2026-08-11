import { GENDER_SERVICE_KINDS } from "./salon-filters";
import { THIMPHU_TZ, thimphuMinutesOfDay } from "./time";
import type { ServiceItem, StaffMember } from "./types/salon";
import { formatDuration } from "./utils";

/**
 * The arithmetic and the narrowing behind the multi-service booking flow.
 *
 * Pure, and here rather than in the wizard, for the reason every other `lib/` module in
 * this repo exists: **`eligibleStaff` is a correctness rule, not a display choice.**
 * `create_booking` and `compute_availability` both raise unless *every* service in the
 * basket is mapped to the chosen stylist in `service_staff`, so a flow that offered a
 * stylist who performs three of four selected services would build a booking the server
 * can only refuse. On live data that is not hypothetical: Norzin lists five services and
 * its stylists perform three.
 *
 * The customer flow booked **one** service at a time until now, which `AGENTS.md` calls
 * the real remaining parity gap — the RPC has taken `p_service_ids` as an array all
 * along, and `components/owner/walk-in-form.tsx` has been sending more than one for a
 * counter booking since 3a. This is the customer's half of it.
 */

/** Nu, summed. `create_booking` prices server-side; this is what the summary quotes. */
export function basketTotal(services: ServiceItem[]): number {
  return services.reduce((sum, s) => sum + s.price, 0);
}

/**
 * Minutes, summed.
 *
 * A quoted duration, not a promise about the appointment: `compute_availability` is
 * what decides whether the whole basket fits inside a stylist's working interval, and
 * it is asked with the same service ids. So this is only ever the number on screen.
 */
export function basketDuration(services: ServiceItem[]): number {
  return services.reduce((sum, s) => sum + s.durationMinutes, 0);
}

/**
 * The stylists who can perform **every** service in the basket.
 *
 * An intersection, not a union, and that is the whole point — see the module note. An
 * empty basket returns everyone, because at that stage nothing has been narrowed yet.
 */
export function eligibleStaff(
  serviceIds: string[],
  staffByService: Record<string, string[]>,
  staff: StaffMember[],
): StaffMember[] {
  if (serviceIds.length === 0) return staff;
  return staff.filter((member) =>
    serviceIds.every((id) => staffByService[id]?.includes(member.id)),
  );
}

/**
 * The services this salon can actually take a booking for.
 *
 * A service mapped to nobody is not bookable at any price, so it is left out of the
 * picker entirely rather than offered and then refused. The count of what was dropped is
 * the caller's to report — `/salon/[id]` already says so in a line under the list.
 */
export function bookableServices(
  services: ServiceItem[],
  staffByService: Record<string, string[]>,
): ServiceItem[] {
  return services.filter((s) => (staffByService[s.id]?.length ?? 0) > 0);
}

/**
 * Adding a service can invalidate the stylist already chosen; this says whether it has.
 *
 * Called on every basket change so the flow can drop a now-impossible stylist at the
 * moment it becomes impossible, rather than letting the customer carry it to the time
 * step and meet an empty slot list with no explanation.
 */
export function staffStillEligible(
  staffId: string,
  serviceIds: string[],
  staffByService: Record<string, string[]>,
): boolean {
  return serviceIds.every((id) => staffByService[id]?.includes(staffId));
}

/**
 * The services matching a gender choice — the booking step's own filter.
 *
 * A port of `filterByGender` (`../tho/app/lib/customer/booking/service_filters.dart:33`),
 * reading `GENDER_SERVICE_KINDS` so this and Discover's server-side query cannot drift about
 * what "Women" admits.
 *
 * **A service with a null `gender` is treated as unisex**, which is the load-bearing part.
 * Every hand-written service predating THO-18 has none — **24 of the 34 live rows** — so
 * reading null as "unknown, hide it" would empty most real menus. It is the same divergence
 * `api/discovery.ts` documents for the cross-salon query, arrived at from the same data.
 *
 * An unrecognised choice (including `any`) returns everything.
 */
export function filterByGender(all: ServiceItem[], gender: string): ServiceItem[] {
  const kinds = GENDER_SERVICE_KINDS[gender];
  if (!kinds) return [...all];
  return all.filter((s) => kinds.includes(s.gender ?? "unisex"));
}

/** Morning · Afternoon · Evening, the three blocks the slot grid is grouped into. */
export type DayPart = "morning" | "afternoon" | "evening";

export const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/** In order, so a caller can render the groups without inventing a sequence. */
export const DAY_PARTS: readonly DayPart[] = ["morning", "afternoon", "evening"];

/**
 * Which block of the day an instant falls in — **in Thimphu time, always.**
 *
 * A port of `_groupByDayPart`'s cut points (`time_step.dart:504`): before 12:00 is morning,
 * before 17:00 afternoon, the rest evening.
 *
 * The timezone is the whole risk, and it is A1-11 upstream: "afternoon" has to mean *the
 * salon's* afternoon. Read in the browser's zone, a chip labelled 14:30 would be filed under
 * Morning for a customer six hours behind — the label and the heading above it disagreeing on
 * the same screen. `thimphuMinutesOfDay` is the same helper every other time comparison here
 * uses.
 */
export function dayPartOf(instant: Date): DayPart {
  const minutes = thimphuMinutesOfDay(instant);
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  return "evening";
}

/**
 * Slots split into the three blocks, in order, **omitting any block with nothing in it.**
 *
 * Returned as a list of pairs rather than a record so the caller renders what exists in the
 * right sequence without filtering — a heading over an empty grid is the thing to avoid, and a
 * salon that opens at 13:00 has no morning at all.
 */
export function groupByDayPart<T>(
  slots: T[],
  startOf: (slot: T) => Date,
): { part: DayPart; label: string; slots: T[] }[] {
  const buckets = new Map<DayPart, T[]>();
  for (const slot of slots) {
    const part = dayPartOf(startOf(slot));
    const existing = buckets.get(part);
    if (existing) existing.push(slot);
    else buckets.set(part, [slot]);
  }
  return DAY_PARTS.filter((part) => buckets.has(part)).map((part) => ({
    part,
    label: DAY_PART_LABELS[part],
    slots: buckets.get(part)!,
  }));
}

/**
 * Why a day has no times — *"No slot fits 1 hr 30 min with Sonam on Fri — try another day, or
 * fewer services."*
 *
 * A port of `noSlotsForSelection` (`service_selection.dart:113`), and it exists because **"the
 * day is full" and "your basket needs one unbroken block" are different problems with different
 * ways out.** `is_bookable_window` requires the whole basket to fit inside a single working-hours
 * interval, so a three-service basket can find nothing on a day with plenty of single-service
 * gaps. A generic *"Nothing free that day"* sends that customer to try every other day in turn,
 * when dropping one service would have worked immediately.
 *
 * Which is why the advice branches on the basket size: suggesting "fewer services" to somebody
 * who chose one would be advice they cannot take.
 */
export function noSlotsForSelection({
  services,
  staffName,
  day,
}: {
  services: ServiceItem[];
  /** The chosen stylist, or a stand-in when "any professional" is selected. */
  staffName: string;
  day: Date;
}): string {
  const block = formatDuration(basketDuration(services));
  const dayName = day.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: THIMPHU_TZ,
  });
  const advice = services.length > 1 ? "try another day, or fewer services." : "try another day.";
  return `No slot fits ${block} with ${staffName} on ${dayName} — ${advice}`;
}

/**
 * The category chips above the service list — **only when the data can fill them.**
 *
 * Fresha's own flow opens with a row of them (`Featured`, `Summer Packages`, …), and
 * copying that shape unconditionally would put a single chip reading "Other" above every
 * salon on this platform: `services.category` is filled on **2 of 33 live rows**. So the
 * row appears only where there are at least two real groups to switch between, which is
 * the condition under which a filter is a filter rather than a label.
 *
 * Returns them in first-seen order — the salon's own order, which is the only ordering
 * information the column carries.
 */
export function serviceCategories(services: ServiceItem[]): string[] {
  const seen: string[] = [];
  for (const s of services) {
    const category = s.category?.trim();
    if (category && !seen.includes(category)) seen.push(category);
  }
  return seen.length >= 2 ? seen : [];
}
