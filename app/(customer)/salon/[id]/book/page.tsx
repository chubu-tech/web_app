import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingWizard } from "@/components/customer/booking-wizard";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchServices, fetchServiceStaff, fetchStaff } from "@/lib/api/salon";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { thimphuToday, toIsoDay } from "@/lib/time";

export const metadata: Metadata = { title: "Book an appointment" };

/**
 * The whole booking flow — services, professional, time, confirm.
 *
 * **This route no longer requires a service and a stylist to enter.** It used to 404
 * without both, because choosing them was `/salon/[id]`'s job and this was only the slot
 * grid. Everything is chosen here now, which is what makes a basket possible at all: a
 * service picker on the previous page can only hand over one.
 *
 * `?service=` is still honoured and is now *repeatable* — it seeds the basket rather than
 * fixing it, so the salon page's price list can still deep-link a specific service and
 * the customer can add a second one without going back.
 *
 * **Nothing is validated here any more, and that is the point.** The old page checked the
 * pair against `service_staff` and 404'd on a mismatch, which was right when the pair came
 * from a URL and there was nowhere to correct it. The wizard re-derives every parameter
 * against this salon's real services and roster on each render and drops what does not
 * fit, so a hand-edited link now *lands on the right step with the impossible parts
 * removed* instead of on a dead end. The server still refuses anything wrong either way —
 * `create_booking` re-checks the pair — so this is about which failure the customer meets.
 *
 * The four reads are the same four the salon page does, and they are all this flow needs:
 * there is no per-step fetch, so moving between steps costs nothing.
 */
export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const [business, services, staffList, staffByService, account] = await Promise.all([
    fetchBusinessById(supabase, id),
    fetchServices(supabase, id),
    fetchStaff(supabase, id),
    fetchServiceStaff(supabase, id),
    getAccount(),
  ]);
  if (!business) notFound();

  /*
    The bottom padding clears `BookingSummary`'s fixed phone bar, and it is that bar's own
    measurement of itself rather than a constant, with `--cta-clearance` as the fallback for the
    server render. The bar's height stopped being predictable when the confirm step began putting
    a block warning and the cancellation term in it at once — see the note in
    `components/customer/booking-summary.tsx`.
  */
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1240px] pb-[calc(var(--booking-cta-clearance,var(--cta-clearance))+env(safe-area-inset-bottom))] tablet:px-lg desktop:pb-lg">
      {/*
        `useSearchParams` suspends on the first client render. This route is dynamic, so
        Next does not *require* the boundary — but without one a slow hydration shows an
        empty page rather than the chrome, and the fallback costs four lines.
      */}
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <BookingWizard
          business={business}
          services={services}
          staff={staffList}
          staffByService={staffByService}
          // Anonymous and guest both meet the wall; only a registered account passes.
          isGuest={account.state !== "registered"}
          // Resolved on the server so the date strip and the availability window cannot
          // disagree with each other across a midnight boundary mid-session.
          today={toIsoDay(thimphuToday())}
        />
      </Suspense>
    </div>
  );
}
