import { NotLinked } from "@/components/staff/not-linked";
import { StaffBookings } from "@/components/staff/staff-bookings";
import { fetchStaffBookings } from "@/lib/api/staff";
import { getStaffContext } from "@/lib/staff/context";
import { createClient } from "@/lib/supabase/server";

/**
 * A stylist's own book — the staff shell's landing tab, matching the app's tab 0.
 *
 * The branch on `me` is explicit here rather than hidden in the layout, for the reason
 * `lib/owner/context.ts` spells out at the bottom: in the App Router a page renders *into*
 * its layout, so a layout cannot stand in for a page's own empty state, and a redirect helper
 * that sent an unlinked stylist somewhere would have to send them to a page that calls the
 * same helper. Two lines, no side effects, and the reason the shell is empty is visible in
 * the page.
 *
 * The read is deliberately **not** `fetchMyBookings`. That one filters on
 * `customer_profile_id` — a stylist's *own customer* appointments, which is a different
 * question and would be empty for most of them. `fetchStaffBookings` filters on
 * `staff_member_id`, and its doc comment explains why that filter is the security boundary
 * rather than a convenience.
 */
export default async function StaffBookingsPage() {
  const { me } = await getStaffContext();
  if (!me) return <NotLinked />;

  const supabase = await createClient();
  const bookings = await fetchStaffBookings(supabase, me.id);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-lg font-medium">Your bookings</h1>
      <StaffBookings bookings={bookings} />
    </div>
  );
}
