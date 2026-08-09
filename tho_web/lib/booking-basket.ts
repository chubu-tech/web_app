import type { ServiceItem, StaffMember } from "./types/salon";

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
