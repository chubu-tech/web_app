import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RescheduleFlow } from "@/components/customer/reschedule-flow";
import { HeroCircleButton } from "@/components/ui/detail-bits";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchBookingById } from "@/lib/api/booking";
import { fetchBusinessById } from "@/lib/api/discovery";
import { cancellationWindow } from "@/lib/booking-guards";
import { getAccount } from "@/lib/session";
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

  const [booking, account] = await Promise.all([
    fetchBookingById(supabase, id),
    getAccount(),
  ]);
  if (!booking) notFound();

  /**
   * **This booking has to belong to the person asking**, and RLS does not establish that.
   *
   * `bookings_select` is `customer_profile_id = auth.uid() OR is_business_member(...)`, so a
   * salon member reading a customer's booking by id gets a row back — and this page would
   * then hand them a working slot picker for somebody else's appointment. The sibling
   * `/bookings/[id]` has refused exactly this since it was written and documents why at
   * length; **this route was missing the check**, which made the detail page's disabled
   * Reschedule button bypassable by typing the URL.
   *
   * The seventh instance of the OR-policy rule in this repo. `reschedule_booking` does allow
   * a member to move a booking, so this is not a privilege escalation — but the console has
   * `/business/bookings/[id]` for that, and a customer route must act for the customer.
   *
   * `notFound()`, not a redirect: the honest answer to "is there such a booking *of yours*"
   * is no.
   */
  if (booking.customerProfileId !== account.user?.id) notFound();

  const business = booking.businessId
    ? await fetchBusinessById(supabase, booking.businessId).catch(() => null)
    : null;

  const services = serviceIds(booking);
  // A cancelled or completed booking has nothing to move, and a walk-in with no staff
  // or no line items has nothing to compute availability from — the app returns an
  // empty slot list in that case, which reads as "no times" and hides the real reason.
  const movable = isActive(booking) && booking.staffMemberId != null && services.length > 0;

  /**
   * Whether the salon's own cancellation window has already closed.
   *
   * `reschedule_booking` raises P0015 past the cutoff (`20260807000032`), measured against
   * the **current** start — so without this the disabled Reschedule button on
   * `/bookings/[id]` is bypassable by typing the URL, and the customer would pick a time,
   * press Move, and only then be refused. The detail page states the rule; this is the
   * route honouring it.
   *
   * `now` is read here, on the server: this page reads cookies, so it is rendered per
   * request and never cached. Fails **open** on a business that would not load, exactly as
   * the button does — the RPC still refuses if the guess was wrong.
   */
  const windowClosed =
    isActive(booking) &&
    (cancellationWindow({
      startTs: booking.startTs,
      windowHours: business?.cancellationWindowHours,
      now: new Date(),
    })?.closed ??
      false);

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

      {movable && !windowClosed ? (
        <RescheduleFlow
          bookingId={id}
          staffId={booking.staffMemberId!}
          serviceIds={services}
        />
      ) : (
        <EmptyState
          icon={Icons.clock}
          title={windowClosed ? "Changes have closed" : "This booking can't be moved"}
          message={
            windowClosed
              ? `${business!.name} takes changes up to ${business!.cancellationWindowHours} hours before an appointment. Call the salon and they can still move it for you.`
              : isActive(booking)
                ? "It has no stylist or services on record, so there are no times to offer. Call the salon to change it."
                : "Only upcoming bookings can be rescheduled."
          }
        />
      )}
    </div>
  );
}
