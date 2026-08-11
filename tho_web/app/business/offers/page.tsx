import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { OfferList } from "@/components/owner/offer-list";
import { fetchOwnerOffers } from "@/lib/api/owner-back-office";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Offers" };

/**
 * Promotions.
 *
 * **No plan gate, on any tier.** Offers are not in `entitlements.ts` at all — the app gates
 * nothing here either — and `offers_public_read` only requires the salon to be active. A Basic
 * salon can run a promotion, which is right: the offer feed is what brings customers to the
 * platform, so charging for the ability to advertise would work against the marketplace.
 *
 * `offers` has **0 rows platform-wide** today, so the empty state is the live case.
 */
export default async function OwnerOffersPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const offers = await fetchOwnerOffers(supabase, active.id);

  return <OfferList businessId={active.id} offers={offers} now={new Date()} />;
}
