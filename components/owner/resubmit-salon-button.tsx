"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { resubmitBusinessForReview } from "@/lib/api/owner-setup";
import { createClient } from "@/lib/supabase/client";

/**
 * Send a rejected salon back to moderation.
 *
 * **Without this a rejection is a dead end.** `businesses.status` is withheld from the
 * owner's column grant (`20260804000004`), so an owner cannot clear it themselves — their
 * only recourse was to create a second salon, which is precisely the mess a moderation queue
 * exists to prevent.
 *
 * Offered on the `rejected` branch alone, because `resubmit_business_for_review` raises
 * `P0001` for any other status. If it is ever reached from another state, that is a stale
 * page rather than a mis-tap, and the server's own sentence says so.
 */
export function ResubmitSalonButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await resubmitBusinessForReview(createClient(), businessId);
      toast.success("Sent back for review.");
      // The status this component renders is what just changed, so the server component
      // above it has to re-read before the notice can stop saying "Not approved yet".
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("resubmitSalon", caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outlined" busy={busy} onClick={() => void send()}>
      {busy ? "Sending…" : "Send back for review"}
    </Button>
  );
}
