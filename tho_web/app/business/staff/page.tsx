import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { StaffList } from "@/components/owner/staff-list";
import { fetchStaff } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff" };

/**
 * The salon's team — a port of `business_staff_tab.dart`.
 *
 * Inactive stylists are listed for the same reason inactive services are: standing someone
 * down is the only escape from Basic's one-stylist cap, so the state has to be visible and
 * reversible.
 *
 * **Which stylists have no hours is read here**, because it is the difference between a
 * stylist who is bookable and one who is not: `is_bookable_window` needs a
 * `staff_working_hours` row the booking fits inside, so a stylist with none can never be
 * booked at all. The app's list does not say so, and the salon's owner has no other way to
 * find out.
 */
export default async function OwnerStaffPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const staff = await fetchStaff(supabase, active.id, { activeOnly: false });

  const { data: hourRows } = await supabase
    .from("staff_working_hours")
    .select("staff_member_id")
    .in("staff_member_id", staff.length > 0 ? staff.map((s) => s.id) : ["-"]);
  const withHours = new Set(
    ((hourRows ?? []) as { staff_member_id: string }[]).map((r) => r.staff_member_id),
  );

  return <StaffList business={active} staff={staff} staffWithHours={[...withHours]} />;
}
