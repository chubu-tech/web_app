import type { Metadata } from "next";
import { LockedTeaser } from "@/components/owner/insight-card";
import { LoyaltyForm } from "@/components/owner/loyalty-form";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { PaywallButton } from "@/components/owner/paywall-button";
import {
  fetchLoyaltyProgram,
  fetchLoyaltyRewards,
  fetchPendingRedemptions,
} from "@/lib/api/owner-back-office";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Loyalty" };

/**
 * The loyalty program.
 *
 * **A locked state the app doesn't draw.** `LoyaltySettingsScreen` has no plan check at all, so
 * on a Basic salon it loads, saves, and works — see `upsertLoyaltyProgram` for why that is a real
 * hole rather than a harmless one. Loyalty is a Growth entitlement, so the gate belongs here even
 * though it is only a client-side gate.
 *
 * Three reads: the program (null when never configured), the rewards including paused ones, and
 * how many redemptions are waiting — that last one so the Redemptions row can say whether it is
 * worth opening.
 */
export default async function OwnerLoyaltyPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  if (!hasFeature(active.plan, "loyalty")) {
    return (
      <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
        <h1 className="text-display-lg text-ink mb-lg font-medium">Loyalty</h1>
        <LockedTeaser
          title="Give your regulars a reason to come back"
          message="Points on every visit, redeemed at the counter for a discount or something free. On Growth and Pro."
          action={<PaywallButton feature="loyalty" label="See plans" />}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const [program, rewards, pending] = await Promise.all([
    fetchLoyaltyProgram(supabase, active.id),
    fetchLoyaltyRewards(supabase, active.id),
    fetchPendingRedemptions(supabase, active.id).catch(() => []),
  ]);

  return (
    <LoyaltyForm
      businessId={active.id}
      program={program}
      rewards={rewards}
      pendingRedemptions={pending.length}
    />
  );
}
