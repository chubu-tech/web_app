import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { SalonHoursForm } from "@/components/owner/salon-hours-form";
import { fetchBusinessHours } from "@/lib/api/discovery";
import { fetchStaff } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Opening hours" };

/**
 * The salon's own opening hours — **the editor neither client has ever had.**
 *
 * `business_hours` is read in three places in the Flutter app (the salon page's hours line,
 * the owner calendar's `% booked`, the stylist editor's closed-day greying) and written
 * **nowhere**. Every live row was seeded out of band, and an owner who opens on Sunday has
 * until now had no way to say so.
 *
 * **What these hours do, and what they do not.** `private.is_bookable_window` reads
 * `businesses.timezone`, then `staff_working_hours` and `staff_time_off` — never this table.
 * So editing here changes what customers are *told* and what the calendar counts, and changes
 * nothing about what can be booked. The page says that in as many words and links to the
 * stylist whose hours actually decide it, because the alternative is an owner adding Sunday,
 * getting no bookings, and having no way to find out why.
 *
 * The roster comes along only to name that link.
 */
export default async function OwnerHoursPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const [hours, staff] = await Promise.all([
    fetchBusinessHours(supabase, active.id),
    fetchStaff(supabase, active.id),
  ]);

  return <SalonHoursForm businessId={active.id} hours={hours} staff={staff} />;
}
