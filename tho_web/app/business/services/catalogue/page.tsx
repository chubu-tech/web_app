import type { Metadata } from "next";
import { CatalogueList } from "@/components/owner/catalogue-list";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { fetchServiceCatalog } from "@/lib/api/owner-setup";
import { fetchServices } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Common services" };

/**
 * The common-services catalogue — a port of `service_catalog_screen.dart`.
 *
 * `service_catalog` is a global, read-only table (20 rows across three genders) of service
 * templates. Switching one on **materialises a `services` row** for this salon from the
 * template and records `catalog_id`, which is how the switch knows it is already on next
 * time. Switching it off deactivates that row rather than deleting it, so the salon's own
 * edits to the price or duration survive.
 *
 * Spelled "catalogue" in the route and "Common services" on screen: the app's screen title is
 * the customer-facing phrase, and the URL is for the owner.
 */
export default async function OwnerCataloguePage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const [catalogue, services] = await Promise.all([
    fetchServiceCatalog(supabase),
    fetchServices(supabase, active.id, { activeOnly: false }),
  ]);

  // catalog_id → whether this salon currently offers it. Both halves matter: a row that
  // exists but is inactive reads as off, and turning it back on reactivates rather than
  // duplicating.
  const enabled: Record<string, boolean> = {};
  for (const s of services) {
    if (s.catalogId) enabled[s.catalogId] = s.isActive;
  }

  return <CatalogueList businessId={active.id} catalogue={catalogue} enabled={enabled} />;
}
