import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { SettingsHub } from "@/components/owner/settings-hub";
import { fetchBusinessHours } from "@/lib/api/discovery";
import {
  countNewOrders,
  fetchClientBook,
  fetchLoyaltyProgram,
  fetchLoyaltyRewards,
  fetchOwnerOffers,
  fetchOwnerProducts,
  fetchPlanRequests,
} from "@/lib/api/owner-back-office";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { offerHiddenReason } from "@/lib/analytics";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

/**
 * The hub — the app's Settings tab plus its entire drawer.
 *
 * The app puts five collapsible accordion groups on one screen and reaches nine other things
 * from a drawer. Here each is a route, so a half-configured salon can be linked to, reloaded
 * and shared, and the back button means what it says.
 *
 * **Every row carries its real state**, read here rather than guessed — and the reads are the
 * point of the page. A hub showing twelve labels and no state would be a menu; this one answers
 * "is there anything to do" before an owner picks a destination.
 *
 * **A locked row is not fetched.** Three of the back-office reads are Growth-gated
 * (`fetchClientBook` raises `P0001` on Basic; products and orders would return rows no customer
 * can see) so on a Basic salon they are skipped and the row states the tier instead. That keeps
 * the hub cheap on the eight basic salons and stops the client-book RPC being called somewhere it
 * would only fail.
 */
export default async function OwnerSettingsPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const clientBook = hasFeature(active.plan, "clientBook");
  const storefront = hasFeature(active.plan, "productStore");
  const loyalty = hasFeature(active.plan, "loyalty");

  const [services, staff, hours, offers, requests, clients, newOrders, products, program, rewards] =
    await Promise.all([
      fetchServices(supabase, active.id, { activeOnly: false }),
      fetchStaff(supabase, active.id, { activeOnly: false }),
      fetchBusinessHours(supabase, active.id),
      fetchOwnerOffers(supabase, active.id).catch(() => []),
      fetchPlanRequests(supabase, active.id).catch(() => []),
      clientBook ? fetchClientBook(supabase, active.id).catch(() => []) : Promise.resolve(null),
      storefront ? countNewOrders(supabase, active.id).catch(() => 0) : Promise.resolve(null),
      storefront ? fetchOwnerProducts(supabase, active.id).catch(() => []) : Promise.resolve(null),
      loyalty ? fetchLoyaltyProgram(supabase, active.id).catch(() => null) : Promise.resolve(null),
      loyalty ? fetchLoyaltyRewards(supabase, active.id).catch(() => []) : Promise.resolve(null),
    ]);

  // Which stylists have no hours at all. One query for the salon rather than one per
  // stylist: `swh_select` admits a business member, so the whole roster's rows come back
  // together and the ids are counted here.
  const { data: hourRows } = await supabase
    .from("staff_working_hours")
    .select("staff_member_id")
    .in("staff_member_id", staff.length > 0 ? staff.map((s) => s.id) : ["-"]);
  const withHours = new Set(
    ((hourRows ?? []) as { staff_member_id: string }[]).map((r) => r.staff_member_id),
  );

  const now = new Date();
  const liveOffers = offers.filter(
    (o) => offerHiddenReason(o, now, () => "") == null,
  ).length;

  return (
    <SettingsHub
      business={active}
      services={services}
      staff={staff}
      hours={hours}
      staffWithoutHours={staff.filter((s) => s.isActive && !withHours.has(s.id)).length}
      clientCount={clients == null ? null : clients.length}
      newOrderCount={newOrders}
      products={products}
      offerCount={offers.length}
      liveOfferCount={liveOffers}
      loyaltyProgram={program}
      loyaltyRewards={rewards}
      pendingPlanRequests={requests.filter((r) => r.status === "pending").length}
    />
  );
}
