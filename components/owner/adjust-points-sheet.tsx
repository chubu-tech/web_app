"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { adjustPoints } from "@/lib/api/owner-back-office";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltyBalance } from "@/lib/types/back-office";

/**
 * Hand-adjust a customer's loyalty points — a port of
 * `tho/app/lib/business/loyalty/adjust_points_sheet.dart`.
 *
 * **Raised from the client page, where the app raises it from the booking detail.** The customer
 * is the subject either way, but a booking is a moment and loyalty is a relationship: an owner
 * deciding to hand somebody 50 points as an apology is thinking about the person, not about last
 * Tuesday. It also keeps the change inside this slice — the owner booking detail is 3a's page.
 *
 * Three rules, all the RPC's and all enforced there too, so this states them rather than
 * duplicating them:
 *
 * - **A reason is required.** The `loyalty_transactions` row it writes is the only record of why
 *   the number moved, and `created_by` is stamped from `auth.uid()`.
 * - **Non-zero.** An adjustment of 0 is not a correction, it is a log entry.
 * - **The balance cannot go negative.** The RPC checks `balance + points >= 0` — the *balance*,
 *   not the spendable figure, so points already held by a pending redemption still count as theirs.
 *   A deduction bigger than what they hold fails with its own sentence, which is passed through.
 */
export function AdjustPointsSheet({
  businessId,
  customerProfileId,
  clientName,
  balance,
}: {
  businessId: string;
  customerProfileId: string;
  clientName: string;
  balance: LoyaltyBalance;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number.parseInt(points.trim(), 10);
  const valid = Number.isFinite(parsed) && parsed !== 0 && reason.trim().length > 0;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await adjustPoints(createClient(), businessId, customerProfileId, parsed, reason.trim());
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(ownerErrorMessage("adjustPoints", caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="border-hairline-soft p-base gap-md mb-lg flex items-center rounded-md border">
        <span className="bg-surface-soft text-ink grid size-11 shrink-0 place-items-center rounded-sm">
          <Icons.reward style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title text-ink font-medium tabular-nums">
            {balance.balance} {balance.balance === 1 ? "point" : "points"}
          </p>
          <p className="text-body-sm text-muted">
            {balance.held > 0
              ? `${balance.available} spendable — ${balance.held} held by a pending reward`
              : "All of it spendable"}
          </p>
        </div>
        <Button variant="quiet" onClick={() => setOpen(true)}>
          Adjust
        </Button>
      </div>

      <Sheet
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        title={`Adjust ${clientName}'s points`}
        footer={
          <Button fullWidth busy={busy} disabled={!valid} onClick={() => void submit()}>
            Save adjustment
          </Button>
        }
      >
        <div className="gap-base flex flex-col">
          <Field
            label="Points (use a minus to take some away)"
            value={points}
            onChange={setPoints}
            type="number"
            inputMode="numeric"
            placeholder="50"
          />
          <Field
            label="Reason"
            value={reason}
            onChange={setReason}
            placeholder="Goodwill after a long wait"
          />
          <p className="text-caption-sm text-muted">
            This is recorded against your name. They currently hold {balance.balance}, so the most
            you can take away is {balance.balance}.
          </p>
          {error ? <p className="text-body-sm text-error-text">{error}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
