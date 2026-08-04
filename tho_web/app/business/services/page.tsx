import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { ServiceList } from "@/components/owner/service-list";
import { fetchServices, fetchServiceStaff } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Services" };

/**
 * The salon's menu — a port of `business_services_tab.dart`'s Services segment.
 *
 * **Inactive services are listed.** `fetchServices` defaults to `activeOnly: true` because
 * every other caller is a customer; here the owner has to see what they switched off, or the
 * switch is one-way in the UI.
 *
 * **`service_staff` is read too**, which the app's screen does not do. Two of Norzin's five
 * services are performed by nobody, and `compute_availability` refuses any such pair — so a
 * service can sit on the menu looking live while being unbookable. That is worth a line on
 * the row, and it is the same read the salon page already makes.
 *
 * The Products segment of the app's tab is not here: products belong with orders, in 3c.
 */
export default async function OwnerServicesPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const [services, serviceStaff] = await Promise.all([
    fetchServices(supabase, active.id, { activeOnly: false }),
    fetchServiceStaff(supabase, active.id),
  ]);

  return (
    <ServiceList
      businessId={active.id}
      services={services}
      staffCountByService={Object.fromEntries(
        Object.entries(serviceStaff).map(([id, staffIds]) => [id, staffIds.length]),
      )}
    />
  );
}
