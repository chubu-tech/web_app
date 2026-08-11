import { staffStillEligible } from "./booking-basket";
import type { Booking } from "./types/booking";
import type { ServiceItem, StaffMember } from "./types/salon";

/**
 * Where a **Book again** tap should land, and with what already filled in.
 *
 * A port of `../tho/app/lib/customer/booking/rebook_resolver.dart` and
 * `BookAgainRow.rebookable` (`home_sections.dart:622`), both added upstream on 2026-08-08.
 *
 * **The resolution runs against the salon's CURRENT menu, never the booking's snapshot.**
 * Prices change and services get deactivated between visits, so a rebook that trusted the
 * old booking would carry a stale price into the flow and offer a service `create_booking`
 * no longer accepts. That is the whole reason this is a resolver and not a link.
 *
 * Pure — no client, no components — so the rule is testable without a network, the same
 * factoring as `booking-guards.ts` and `booking-basket.ts`.
 */

/** Which step of the booking wizard a rebook opens on. */
export type RebookStep = "services" | "professional" | "time";

export type RebookResolution = {
  step: RebookStep;
  /** The services from the past booking still on the menu and active, in **menu order**. */
  services: ServiceItem[];
  /** The past stylist, when still active and still able to do everything. Else null. */
  staff: StaffMember | null;
  /** One sentence naming what changed since last time, or null when nothing did. */
  changeNote: string | null;
};

/**
 * The one change that needs saying out loud.
 *
 * A departed stylist needs no sentence: step 2 opens with the roster in front of the
 * customer, which says it better than a banner could. A missing *service* has no such
 * screen — the basket simply arrives smaller than the customer expects — so it gets words.
 */
const SERVICE_GONE = "A service from last time is no longer offered.";

/**
 * Resolve a past booking against the salon's current menu, roster and service mapping.
 *
 * `staffByService` is service id → the staff ids who perform it, which is what
 * `fetchServiceStaff` already returns and what the booking wizard already holds. The Dart
 * keys the same relation the other way (staff → services) and gives a **null** entry the
 * meaning *"no mapping was read, treat this person as capable"*, because the
 * `service_staff` read is decorative there and a failed read must not make a salon
 * unbookable.
 *
 * That intent is kept, expressed in this shape: **an empty map means the mapping was not
 * read and the stylist survives**; a populated map that does not pair them with every
 * surviving service rules them out. Deliberately not a second keying of one relation —
 * two shapes for the same fact is how the two surfaces would come to disagree about who is
 * eligible.
 */
export function resolveRebook({
  booking,
  menu,
  staff,
  staffByService,
}: {
  booking: Booking;
  menu: ServiceItem[];
  staff: StaffMember[];
  staffByService: Record<string, string[]>;
}): RebookResolution {
  const wanted = new Set(
    (booking.items ?? []).map((i) => i.serviceId).filter((id): id is string => id != null),
  );

  /*
    Menu order, not booking order. The flow renders the basket against the menu, so keeping
    the menu's order is what stops step 1 appearing to reshuffle itself the moment it opens.
  */
  const services = menu.filter((s) => s.isActive && wanted.has(s.id));

  if (services.length !== wanted.size) {
    return { step: "services", services, staff: null, changeNote: SERVICE_GONE };
  }

  const past = staff.find((s) => s.id === booking.staffMemberId && s.isActive) ?? null;
  const mappingRead = Object.keys(staffByService).length > 0;
  const stillCapable =
    past != null &&
    (!mappingRead ||
      staffStillEligible(
        past.id,
        services.map((s) => s.id),
        staffByService,
      ));

  if (!stillCapable) {
    return { step: "professional", services, staff: null, changeNote: null };
  }

  return { step: "time", services, staff: past, changeNote: null };
}

/**
 * The bookings worth offering again: completed, newest first, **one per salon**, capped.
 *
 * The dedupe is the point rather than tidiness. A regular who visits one shop weekly would
 * otherwise see that shop three times and be offered no choice at all — which is the
 * opposite of what a row of three cards is for.
 *
 * Only `completed`. A cancelled booking is not evidence anybody wants to go back, and an
 * upcoming one is already on `/bookings`.
 */
export function rebookable(all: Booking[], limit = 3): Booking[] {
  const done = all
    .filter((b) => b.status === "completed" && b.businessId != null)
    .sort((a, b) => b.startTs.getTime() - a.startTs.getTime());

  const seen = new Set<string>();
  const out: Booking[] = [];
  for (const b of done) {
    if (seen.has(b.businessId!)) continue;
    seen.add(b.businessId!);
    out.push(b);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * `Haircut · Asha` · `Haircut +1 · Asha` · just the services when no stylist was recorded.
 *
 * Mirrors the "name one, count the rest" shape the rest of the app uses, so the card stays
 * one line at 200px wide.
 */
export function rebookSubtitle(b: Booking): string {
  const names = (b.items ?? []).map((i) => i.name);
  const services =
    names.length === 0 ? "" : names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`;
  if (services === "") return b.staffName ?? "";
  return b.staffName ? `${services} · ${b.staffName}` : services;
}
