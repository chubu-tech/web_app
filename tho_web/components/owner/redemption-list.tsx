"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { cancelRedemption, confirmRedemption } from "@/lib/api/owner-back-office";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltyRedemption } from "@/lib/types/back-office";

/**
 * The redemptions counter — a port of
 * `tho/app/lib/business/loyalty/redemptions_screen.dart`.
 *
 * **Two ways in, because there are two situations.** A customer who booked through the app is a
 * row on the list and gets a button. A customer standing at the counter reading a code off their
 * phone is a typed code — and `confirm_redemption` takes an id *or* a code, upper-cases the code
 * itself, and takes a row lock before checking the status, so two tills cannot both honour the
 * same one.
 *
 * The RPC authorises with `is_business_member`, so a **stylist** can confirm a reward. That is
 * right: the person at the till is not always the owner.
 *
 * Confirming moves points. `cancel_redemption` releases the hold instead — the points were never
 * deducted, only held, which is what `loyalty_balance`'s `held` column is for.
 */
export function RedemptionList({
  businessId,
  redemptions,
}: {
  businessId: string;
  redemptions: LoyaltyRedemption[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm(by: { redemptionId?: string; code?: string }, name: string) {
    setBusy(true);
    try {
      await confirmRedemption(createClient(), businessId, by);
      setCode("");
      toast.success(`${name} confirmed.`);
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("confirmRedemption", caught));
    } finally {
      setBusy(false);
    }
  }

  async function decline(r: LoyaltyRedemption) {
    setBusy(true);
    try {
      await cancelRedemption(createClient(), r.id);
      toast.success("Redemption declined — their points are back.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("declineRedemption", caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gap-lg flex flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void confirm({ code: code.trim() }, "Reward");
        }}
        className="border-hairline-soft p-base gap-sm flex items-end rounded-md border"
      >
        <div className="flex-1">
          <Field
            label="Code from the customer"
            value={code}
            onChange={setCode}
            placeholder="e.g. 7K4QP2"
            autoCapitalize="characters"
          />
        </div>
        <Button type="submit" busy={busy} disabled={!code.trim()}>
          Confirm
        </Button>
      </form>

      {redemptions.length === 0 ? (
        <EmptyState
          icon={Icons.inbox}
          title="No pending redemptions"
          message="When a customer claims a reward it appears here with a code."
        />
      ) : (
        <ul className="gap-md flex flex-col">
          {redemptions.map((r) => (
            <li
              key={r.id}
              className="border-hairline-soft bg-canvas p-base rounded-md border"
            >
              <p className="text-title text-ink font-medium">{r.nameSnapshot}</p>
              <p className="text-body-sm text-muted">
                <span className="font-mono tracking-wider">{r.code}</span> · {r.pointCost} pts ·
                asked {askedLabel(r.requestedAt)}
              </p>
              <div className="gap-sm mt-md flex">
                <Button
                  busy={busy}
                  onClick={() => void confirm({ redemptionId: r.id }, r.nameSnapshot)}
                >
                  Confirm
                </Button>
                <Button variant="outlined" disabled={busy} onClick={() => void decline(r)}>
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function askedLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Thimphu",
  }).format(d);
}
