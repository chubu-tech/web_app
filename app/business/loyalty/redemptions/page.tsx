import type { Metadata } from "next";
import Link from "next/link";
import { LockedTeaser } from "@/components/owner/insight-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { PaywallButton } from "@/components/owner/paywall-button";
import { RedemptionList } from "@/components/owner/redemption-list";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchPendingRedemptions } from "@/lib/api/owner-back-office";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Redemptions" };

/**
 * Rewards waiting to be honoured.
 *
 * A sub-route of `/business/loyalty` rather than a segment on it, because it is a different job:
 * the loyalty page is configuration an owner sets and leaves, this is a queue somebody works
 * through at the till — and it wants to be openable on a phone in one tap from a bookmark.
 *
 * `loyalty_redemptions` has **0 rows platform-wide** and no writer in this app: only
 * `request_redemption` creates one, and that is the customer's side, arriving in 2f. So the empty
 * state is the live state, and verification creates a row through the RPC as the customer.
 */
export default async function OwnerRedemptionsPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  // Locked rather than 404. It first 404'd here, and that was wrong for a bookmarkable
  // sub-route: an owner who saved this page while on Growth and later dropped to Basic would be
  // told the page does not exist, when what changed is their plan. Every other gated route in the
  // console states the tier; this one now does too.
  if (!hasFeature(active.plan, "loyalty")) {
    return (
      <Shell>
        <LockedTeaser
          title="Honour rewards at the counter"
          message="Customers claim a reward, you confirm it here or by the code they show you. On Growth and Pro."
          action={<PaywallButton feature="loyalty" label="See plans" />}
        />
      </Shell>
    );
  }

  const supabase = await createClient();
  const redemptions = await fetchPendingRedemptions(supabase, active.id);

  return (
    <Shell>
      <p className="text-body-sm text-muted mb-lg">
        Confirm a reward from the list, or type the code the customer shows you.
      </p>
      <RedemptionList businessId={active.id} redemptions={redemptions} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <Link
        href="/business/loyalty"
        className="text-caption text-muted hover:text-ink gap-xs mb-md inline-flex items-center"
      >
        <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        Loyalty
      </Link>
      <h1 className="text-display-lg text-ink mb-xs font-medium">Redemptions</h1>
      {children}
    </div>
  );
}
