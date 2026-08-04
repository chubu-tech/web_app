import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { SettingsHub } from "@/components/owner/settings-hub";
import { fetchBusinessHours } from "@/lib/api/discovery";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

/**
 * The setup hub — the app's Settings tab plus the two drawer items that belong with it.
 *
 * The app puts five collapsible accordion groups on one screen and reaches Services and
 * Staff from a drawer. Here each is a route, so a half-configured salon can be linked to,
 * reloaded and shared, and the back button means what it says.
 *
 * **Every row carries its real state**, read here rather than guessed: how many services
 * are live and how many are switched off, which days the shop opens, how many stylists have
 * no hours yet. That last one matters more than it looks — a stylist with no
 * `staff_working_hours` rows cannot be booked at all, and nothing else in the console says
 * so.
 *
 * The four reads are the same ones the pages below do, and they are cheap; a hub that
 * showed four labels and no state would just be a menu.
 */
export default async function OwnerSettingsPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const [services, staff, hours] = await Promise.all([
    fetchServices(supabase, active.id, { activeOnly: false }),
    fetchStaff(supabase, active.id, { activeOnly: false }),
    fetchBusinessHours(supabase, active.id),
  ]);

  // Which stylists have no hours at all. One query for the salon rather than one per
  // stylist: `swh_select` admits a business member, so the whole roster's rows come back
  // together and the ids are counted here.
  const { data: hourRows } = await supabase
    .from("staff_working_hours")
    .select("staff_member_id")
    .in("staff_member_id", staff.length > 0 ? staff.map((s) => s.id) : ["-"]);
  const withHours = new Set(
    ((hourRows ?? []) as { staff_member_id: string }[]).map((r) => r.staff_member_id),
  );

  return (
    <SettingsHub
      business={active}
      services={services}
      staff={staff}
      hours={hours}
      staffWithoutHours={staff.filter((s) => s.isActive && !withHours.has(s.id)).length}
    />
  );
}
