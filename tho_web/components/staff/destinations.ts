import { Icons } from "@/components/ui/icons";

/**
 * The staff shell's destinations — the app's own two, in the app's own order
 * (`staff/staff_home.dart:69-72`).
 *
 * A third parallel module beside `customer/destinations.ts` and `owner/destinations.ts`,
 * for the reason the owner one gives: the three shells differ in more than their items.
 * This one carries no `ready` flag, because unlike the other two it did not land in
 * instalments — both routes exist the moment the shell does, so a flag would have exactly
 * one value for ever and would be a thing to misread.
 *
 * `exact` on Bookings matters for the same reason it does in the console: `/staff` is the
 * bookings list and `/staff/schedule` is its sibling, so plain prefix matching would light
 * both at once.
 */
export type StaffDestination = {
  href: string;
  label: string;
  icon: typeof Icons.booking;
  exact?: boolean;
};

export const STAFF_TABS: StaffDestination[] = [
  {
    href: "/staff",
    label: "Bookings",
    icon: Icons.booking,
    exact: true,
  },
  {
    href: "/staff/schedule",
    label: "Schedule",
    icon: Icons.clock,
  },
];
