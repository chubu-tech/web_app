import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/customer/booking-flow";
import { HeroCircleButton } from "@/components/ui/detail-bits";
import { Icons } from "@/components/ui/icons";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchServices, fetchServiceStaff, fetchStaff } from "@/lib/api/salon";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatDuration, formatNu } from "@/lib/utils";

export const metadata: Metadata = { title: "Choose a time" };

/**
 * Pick a time for a service and stylist already chosen on the salon page.
 *
 * **The pair is validated here, not trusted.** `?service=` and `?staff=` come from a
 * URL, so both must belong to *this* salon and both must be active — otherwise a
 * hand-edited link would reach `create_booking` with a mismatched pair and rely on the
 * RPC to notice. It would, but a 404 is the honest answer to a link that never
 * existed.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ service?: string | string[]; staff?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const serviceId = Array.isArray(query.service) ? query.service[0] : query.service;
  const staffId = Array.isArray(query.staff) ? query.staff[0] : query.staff;
  if (!serviceId || !staffId) notFound();

  const supabase = await createClient();
  const [business, services, staffList, staffByService, account] = await Promise.all([
    fetchBusinessById(supabase, id),
    fetchServices(supabase, id),
    fetchStaff(supabase, id),
    fetchServiceStaff(supabase, id),
    getAccount(),
  ]);
  if (!business) notFound();

  const service = services.find((s) => s.id === serviceId);
  const staff = staffList.find((s) => s.id === staffId);
  if (!service || !staff) notFound();

  // Both exist — but do they go together? `compute_availability` and `create_booking`
  // both require the pair to be in `service_staff` and raise otherwise, so a pair
  // nobody performs would render a slot grid that can only error. 404 instead: the
  // link never described a real appointment.
  if (!staffByService[service.id]?.includes(staff.id)) notFound();

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] pb-40 tablet:px-lg">
      <div className="gap-md mb-lg flex items-start">
        <HeroCircleButton
          icon={Icons.back}
          label={`Back to ${business.name}`}
          href={`/salon/${id}`}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-lg text-ink truncate font-medium">{service.name}</h1>
          <p className="text-body-sm text-muted">
            with {staff.displayName} · {formatDuration(service.durationMinutes)} ·{" "}
            {formatNu(service.price)}
          </p>
          <Link
            href={`/salon/${id}`}
            className="text-caption text-rausch-cta mt-xxs inline-block font-medium underline"
          >
            {business.name}
          </Link>
        </div>
      </div>

      <BookingFlow
        business={business}
        service={service}
        staff={staff}
        // Anonymous and guest both meet the wall; only a registered account passes.
        isGuest={account.state !== "registered"}
      />
    </div>
  );
}
