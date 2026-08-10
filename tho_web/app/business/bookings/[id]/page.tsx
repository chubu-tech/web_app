import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingDetail } from "@/components/owner/booking-detail";
import { BookingMoney } from "@/components/owner/booking-money";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { fetchBookingPayments, signedBookingMediaUrls } from "@/lib/api/booking";
import { fetchBusinessBookingById } from "@/lib/api/owner";
import { fetchLoyaltyBalance, fetchLoyaltyProgram } from "@/lib/api/owner-back-office";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { customerName, type Payment } from "@/lib/types/booking";

export const metadata: Metadata = { title: "Booking" };

/**
 * One booking, the salon's side.
 *
 * **The read is scoped to the active salon**, not just to the booking id. `bookings_select`
 * OR-matches the customer or *any* business member, so an owner of nine salons asking for a
 * bare id would be handed a booking from whichever of their shops it belonged to, under a
 * header naming the shop they are currently looking at. Passing `business_id` means the
 * page 404s instead — and the same query is what refuses another salon's booking outright.
 *
 * Everything below the read is `BookingDetail`, which `/staff/bookings/[id]` also renders:
 * the two routes differ in *which booking they may open*, not in what a booking looks like.
 * See that component for why the actions work for a stylist as well as an owner.
 */
export default async function OwnerBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const { id } = await params;
  const supabase = await createClient();

  const booking = await fetchBusinessBookingById(supabase, active.id, id);
  if (!booking) notFound();

  /**
   * The money blocks, both of which the app has here and the console did not.
   *
   * - **The payments ledger** was written in Phase 2 (`fetchBookingPayments`) and wired only to
   *   the *customer's* receipt, so the salon could not see what it had recorded against its own
   *   booking. Reader only, deliberately: `record_payment` is Pro-gated and cash at the till is
   *   the whole model.
   * - **Points** were reachable only from `/business/clients/[id]`, so an owner with the
   *   booking in front of them had to leave it to correct a balance.
   *
   * Neither may take the page down, so both `.catch()`. The loyalty read is skipped entirely
   * for a salon with no programme and for a walk-in with no profile — `adjust_points` needs
   * somebody to credit, and a 0-point card on a salon that has never run loyalty is a statement
   * about a scheme that does not exist.
   */
  const runsLoyalty = hasFeature(active.plan, "loyalty");
  const customerId = booking.customerProfileId;

  const [photoUrls, payments, program] = await Promise.all([
    // Private bucket: `booking_attachments.url` holds object *paths*, and they need signing
    // before `next/image` can render them. A failed signing costs the strip, not the page.
    signedBookingMediaUrls(supabase, booking.attachmentPaths ?? []).catch(
      () => [] as string[],
    ),
    fetchBookingPayments(supabase, id).catch(() => [] as Payment[]),
    runsLoyalty && customerId
      ? fetchLoyaltyProgram(supabase, active.id).catch(() => null)
      : Promise.resolve(null),
  ]);

  const balance =
    program && customerId
      ? await fetchLoyaltyBalance(supabase, active.id, customerId).catch(() => null)
      : null;

  return (
    <BookingDetail
      booking={booking}
      photoUrls={photoUrls}
      back={{ href: "/business", label: "Calendar" }}
      afterBill={
        <BookingMoney
          payments={payments}
          totalPrice={booking.totalPrice}
          loyalty={
            balance && customerId
              ? {
                  businessId: active.id,
                  customerProfileId: customerId,
                  clientName: customerName(booking),
                  balance,
                }
              : null
          }
        />
      }
    />
  );
}
