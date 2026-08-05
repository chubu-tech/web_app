"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePollTick } from "@/components/customer/use-poll";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { cancelRedemption } from "@/lib/api/owner-back-office";
import { fetchMyRedemptionById } from "@/lib/api/shop";
import { shopErrorMessage } from "@/lib/api/shop-errors";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltyRedemption } from "@/lib/types/back-office";

/**
 * The code a customer shows at the counter — a port of `RedemptionCodeScreen` in
 * `tho/app/lib/customer/loyalty/redemption_code_screen.dart`.
 *
 * **It polls, where the app makes you press "Refresh status".** The customer is standing at the till
 * with this open while somebody behind it types the code into the owner's redemptions inbox; the
 * screen should change by itself the moment they do. `usePollTick` already does this for the queue
 * position, for the same reason and with the same rules — a hidden tab doesn't poll, and returning to
 * it bumps immediately.
 *
 * **Polling stops the moment it is settled.** `pending` is the only status worth watching; once it is
 * `confirmed`, `cancelled` or `expired` there is nothing more to see, so the timer is paused rather
 * than left running against a row that will never change again.
 *
 * **The points are held, not spent, until the salon confirms.** So Cancel is a real affordance while
 * pending — it releases the hold — and disappears the instant it is honoured, because `cancel_redemption`
 * refuses anything that is not pending.
 */
export function RedemptionCode({
  initial,
  userId,
}: {
  initial: LoyaltyRedemption;
  userId: string;
}) {
  const router = useRouter();
  const [redemption, setRedemption] = useState(initial);
  const [busy, setBusy] = useState(false);

  const settled = redemption.status !== "pending";
  const tick = usePollTick(4000, settled);

  useEffect(() => {
    if (tick === 0 || settled) return;
    let live = true;
    void (async () => {
      try {
        const fresh = await fetchMyRedemptionById(createClient(), userId, redemption.id);
        if (live && fresh) setRedemption(fresh);
      } catch {
        // Keep the last known state. A failed poll is not news; the code on screen is still the
        // code, and the next tick will try again.
      }
    })();
    return () => {
      live = false;
    };
    // Keyed on the tick alone: adding `redemption` would refetch on every state change, which is
    // exactly what the poll already does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, settled, userId]);

  async function cancel() {
    setBusy(true);
    try {
      await cancelRedemption(createClient(), redemption.id);
      toast.success("Reward released — your points are back.");
      router.push("/rewards");
    } catch (caught) {
      toast.error(shopErrorMessage("cancelRedemption", caught));
      setBusy(false);
    }
  }

  if (redemption.status === "confirmed") {
    return (
      <div className="py-xl flex flex-col items-center text-center">
        <Icons.success
          className="text-success-text"
          style={{ width: IconSize.hero, height: IconSize.hero }}
          aria-hidden
        />
        <h2 className="text-display-lg text-ink mt-md font-medium">{redemption.nameSnapshot}</h2>
        <p className="text-title text-success-text mt-sm font-medium">Enjoy your reward.</p>
        <p className="text-body-sm text-muted mt-xs">
          The salon has honoured this and your {redemption.pointCost} points are spent.
        </p>
        <Button variant="outlined" className="mt-lg" onClick={() => router.push("/rewards")}>
          Back to my rewards
        </Button>
      </div>
    );
  }

  if (settled) {
    return (
      <div className="py-xl flex flex-col items-center text-center">
        <Icons.info
          className="text-muted"
          style={{ width: IconSize.xl, height: IconSize.xl }}
          aria-hidden
        />
        <h2 className="text-display-sm text-ink mt-md font-medium">{redemption.nameSnapshot}</h2>
        <p className="text-body-md text-muted mt-sm">
          {redemption.status === "cancelled"
            ? "This claim was cancelled, and the points went back to your balance."
            : "This claim expired, and the points went back to your balance."}
        </p>
        <Button variant="outlined" className="mt-lg" onClick={() => router.push("/rewards")}>
          Back to my rewards
        </Button>
      </div>
    );
  }

  return (
    <div className="py-lg flex flex-col items-center text-center">
      <Icons.gift
        className="text-rausch"
        style={{ width: IconSize.hero, height: IconSize.hero }}
        aria-hidden
      />
      <h2 className="text-display-lg text-ink mt-md font-medium">{redemption.nameSnapshot}</h2>
      <p className="text-body-md text-body mt-sm">Show this code at the counter.</p>

      <p className="text-ink my-lg font-mono text-[34px] leading-none font-bold tracking-[0.2em]">
        {redemption.code}
      </p>

      <p className="text-body-sm text-muted">
        {redemption.pointCost} points are held until the salon confirms — not spent yet.
      </p>
      <p className="text-caption-sm text-muted-soft mt-xs">
        This page updates by itself the moment they do.
      </p>

      <Button variant="quiet" className="mt-lg" busy={busy} onClick={() => void cancel()}>
        Cancel this claim
      </Button>
    </div>
  );
}
