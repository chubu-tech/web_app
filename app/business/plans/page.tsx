import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { PlanCards } from "@/components/owner/plan-cards";
import { fetchPlanRequests } from "@/lib/api/owner-back-office";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plan & billing" };

/**
 * What this salon is on, what the other tiers cost, and how to move.
 *
 * The prices come from `lib/plans.ts` — the single place pricing lives, shared with the paywall
 * sheet, so the two cannot quote different numbers at the same owner. **Nu 399 / 699 / 1,499, and
 * there is no free tier**: Basic is the entry price, not a giveaway.
 *
 * The request itself, and why it exists here but not in the phone app, is documented on
 * `PlanCards`.
 */
export default async function OwnerPlansPage() {
  const { active, userId } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const requests = await fetchPlanRequests(supabase, active.id).catch(() => []);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-xs font-medium">Plan &amp; billing</h1>
      <p className="text-body-sm text-muted mb-lg">
        Payment is arranged with us directly — no card is taken in the app or on this site. Ask for
        a tier and we&apos;ll be in touch about bank transfer or mBoB.
      </p>

      <PlanCards
        businessId={active.id}
        userId={userId}
        currentPlan={active.plan}
        requests={requests}
      />
    </div>
  );
}
