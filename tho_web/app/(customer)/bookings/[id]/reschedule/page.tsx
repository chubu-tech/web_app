import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RescheduleFlow } from "@/components/customer/reschedule-flow";
import { HeroCircleButton } from "@/components/ui/detail-bits";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchBookingById } from "@/lib/api/booking";
import { createClient } from "@/lib/supabase/server";
import { isActive, serviceIds, servicesSummary } from "@/lib/types/booking";

export const metadata: Metadata = { title: "Reschedule" };

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const booking = await fetchBookingById(supabase, id);
  if (!booking) notFound();

  const services = serviceIds(booking);
  // A cancelled or completed booking has nothing to move, and a walk-in with no staff
  // or no line items has nothing to compute availability from — the app returns an
  // empty slot list in that case, which reads as "no times" and hides the real reason.
  const movable = isActive(booking) && booking.staffMemberId != null && services.length > 0;

  return (
    // Clears `RescheduleFlow`'s fixed "Move to HH:MM" bar. See the note on `/salon/[id]/book`.
    <div className="px-base py-lg mx-auto w-full max-w-[720px] pb-[calc(var(--cta-clearance)+env(safe-area-inset-bottom))] tablet:px-lg">
      <div className="gap-md mb-lg flex items-start">
        <HeroCircleButton
          icon={Icons.back}
          label="Back to this booking"
          href={`/bookings/${id}`}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-lg text-ink font-medium">Reschedule</h1>
          <p className="text-body-sm text-muted truncate">
            {booking.businessName ?? "Salon"} · {servicesSummary(booking)}
            {booking.staffName ? ` · with ${booking.staffName}` : ""}
          </p>
        </div>
      </div>

      {movable ? (
        <RescheduleFlow
          bookingId={id}
          staffId={booking.staffMemberId!}
          serviceIds={services}
        />
      ) : (
        <EmptyState
          icon={Icons.clock}
          title="This booking can't be moved"
          message={
            isActive(booking)
              ? "It has no stylist or services on record, so there are no times to offer. Call the salon to change it."
              : "Only upcoming bookings can be rescheduled."
          }
        />
      )}
    </div>
  );
}
