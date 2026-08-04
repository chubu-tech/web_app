import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { StaffEditor } from "@/components/owner/staff-editor";
import { fetchBusinessHours } from "@/lib/api/discovery";
import { fetchBusinessBookings } from "@/lib/api/owner";
import {
  fetchStaffPhotoRows,
  fetchStaffServiceIds,
  fetchStaffWorkingHours,
} from "@/lib/api/owner-setup";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit staff" };

/**
 * One stylist — a port of `staff_edit_screen.dart`.
 *
 * **The stylist is found in the active salon's roster, not read by id.** `staff_select` is
 * public for any active stylist of any live salon, so a plain `.eq("id", …)` would happily
 * return someone else's employee and render an editor whose every write then failed on RLS.
 * The same ownership check `/business/bookings/[id]` makes, and for the same reason.
 *
 * **Six reads, one round trip.** `staff_working_hours` and `service_staff` are what the
 * editor writes; `services` is the checkbox list; `business_hours` decides which weekdays
 * render editable (guidance only — `compute_availability` never consults it); the salon's
 * upcoming bookings are what the conflict warning counts. The bookings read covers 60 days
 * from now, exactly as `_conflictingBookings` does, and is filtered to this stylist here so
 * the client holds only what it needs.
 */
export default async function OwnerStaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const roster = await fetchStaff(supabase, active.id, { activeOnly: false });
  const member = roster.find((s) => s.id === id);
  if (!member) notFound();

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 86_400_000);

  const [services, serviceIds, hours, photos, salonHours, bookings] = await Promise.all([
    fetchServices(supabase, active.id, { activeOnly: false }),
    fetchStaffServiceIds(supabase, id),
    fetchStaffWorkingHours(supabase, id),
    fetchStaffPhotoRows(supabase, id),
    // Its own failure must not blank the screen: it only greys weekdays out, so an empty
    // array means "every day editable", which is what `openWeekdaysFrom` already does for an
    // unseeded salon.
    fetchBusinessHours(supabase, active.id).catch(() => []),
    fetchBusinessBookings(supabase, active.id, { from: now, to: in60Days }).catch(() => []),
  ]);

  return (
    <StaffEditor
      business={active}
      member={member}
      services={services}
      initialServiceIds={serviceIds}
      initialHours={hours}
      salonHours={salonHours}
      photos={photos}
      upcoming={bookings.filter((b) => b.staffMemberId === id)}
    />
  );
}
