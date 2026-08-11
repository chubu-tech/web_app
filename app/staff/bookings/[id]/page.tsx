import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingDetail } from "@/components/owner/booking-detail";
import { signedBookingMediaUrls } from "@/lib/api/booking";
import { fetchStaffBookingById } from "@/lib/api/staff";
import { getStaffContext } from "@/lib/staff/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Booking",
  // A customer's name, phone and note. Nothing here belongs in a search result.
  robots: { index: false, follow: false },
};

/**
 * One of a stylist's own appointments — **the last route the staff role was missing.**
 *
 * The app opens `BusinessBookingDetailScreen` straight from a stylist's list, but its web
 * equivalent lived only at `/business/bookings/[id]`, which `getOwnerContext` closes to a
 * stylist. So `staff-bookings.tsx` passed `href={null}` and the cards were inert: a stylist
 * could see that a booking existed and could do nothing to it — not complete it, not mark a
 * no-show, not phone the customer — while `set_booking_status` would have taken every one of
 * those writes. Six capabilities were behind one missing route.
 *
 * **The scope is `fetchStaffBookingById`'s second `.eq()`, not this shell.** Landing here does
 * not mean the booking is theirs: `bookings_select` admits any business member, so the read
 * filters on `staff_member_id` and this page 404s on anything else — including another
 * stylist's booking in the same salon. See that function.
 *
 * `me == null` is a stylist nobody has linked yet. They have no bookings by construction, so
 * there is no id that could be theirs and a 404 is the honest answer rather than the
 * "Not linked yet" state, which belongs on `/staff` where there is something to explain.
 */
export default async function StaffBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { me } = await getStaffContext();
  if (!me) notFound();

  const { id } = await params;
  const supabase = await createClient();

  const booking = await fetchStaffBookingById(supabase, me.id, id);
  if (!booking) notFound();

  // Signed, like the owner's: the bucket is private and holds paths, not URLs. A failure
  // costs the strip rather than the page.
  const photoUrls = await signedBookingMediaUrls(
    supabase,
    booking.attachmentPaths ?? [],
  ).catch(() => [] as string[]);

  return (
    <BookingDetail
      booking={booking}
      photoUrls={photoUrls}
      // Back to their own list, never into the console — `/business` redirects a stylist out.
      back={{ href: "/staff", label: "My bookings" }}
    />
  );
}
