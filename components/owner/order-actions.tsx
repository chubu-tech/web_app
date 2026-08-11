"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { setOrderStatus } from "@/lib/api/owner-back-office";
import { canOwnerTransition } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/types/back-office";

/**
 * What an owner can do to an order — a port of the action half of
 * `tho/app/lib/business/shop/order_detail_screen.dart`.
 *
 * ## There is no Undo, and that is a fact about the state machine
 *
 * `set_order_status` allows `new → ready`, `ready → collected`, and `declined` from either.
 * Every one of those is one-directional, and `collected` / `cancelled` / `declined` are
 * terminal — so `canOwnerTransition(target, previous)` is **never** true for a reverse move. The
 * app reasons this out in a comment and then shows a plain success toast; the same conclusion
 * here, arrived at the same way, which is why `canOwnerTransition` is imported rather than
 * assumed: if the RPC ever gains a reverse transition, this is where an Undo would appear.
 *
 * ## Declining needs a reason, and the customer reads it
 *
 * The RPC refuses without one, and the reason travels into the customer's `order_declined`
 * notification. So the sheet requires it before the button is live, rather than letting the
 * server reject an empty string — an owner shouldn't have to be told twice that "why" is the
 * whole point of declining rather than ignoring.
 *
 * No optimistic flip. The app does one (with a rollback) because a phone on Bhutanese mobile
 * data can wait seconds for a round trip; here the write is followed by `router.refresh()` and
 * the server re-renders the real row, which cannot disagree with the database the way an
 * optimistic guess can.
 */
export function OrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  const terminal = !canOwnerTransition(status, "ready") && !canOwnerTransition(status, "declined");
  if (terminal) {
    return (
      <p className="text-body-sm text-muted">
        This order is finished — nothing more to do on it.
      </p>
    );
  }

  async function move(target: OrderStatus, action: "orderReady" | "orderCollected", note: string) {
    setBusy(true);
    try {
      await setOrderStatus(createClient(), orderId, target);
      toast.success(note);
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage(action, caught));
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await setOrderStatus(createClient(), orderId, "declined", trimmed);
      setDeclining(false);
      toast.success("Order declined — the customer has been told why.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("orderDecline", caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gap-sm flex flex-col">
      {status === "new" ? (
        <Button
          fullWidth
          busy={busy}
          onClick={() => void move("ready", "orderReady", "Marked ready — the customer knows.")}
        >
          Mark ready
        </Button>
      ) : null}
      {status === "ready" ? (
        <Button
          fullWidth
          busy={busy}
          onClick={() => void move("collected", "orderCollected", "Collected. That's the lot.")}
        >
          Mark collected
        </Button>
      ) : null}
      <Button variant="outlined" fullWidth disabled={busy} onClick={() => setDeclining(true)}>
        Decline
      </Button>

      <Sheet
        key={declining ? "open" : "closed"}
        open={declining}
        onClose={() => setDeclining(false)}
        title="Decline this order"
        footer={
          <Button
            fullWidth
            busy={busy}
            disabled={!reason.trim()}
            onClick={() => void decline()}
          >
            Decline order
          </Button>
        }
      >
        <div className="gap-sm flex flex-col">
          <label className="text-caption text-muted" htmlFor="decline-reason">
            The customer sees this, so say what happened.
          </label>
          <textarea
            id="decline-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Out of stock until Friday."
            className="border-hairline text-body-md text-ink placeholder:text-muted-soft focus:border-ink p-md rounded-sm border outline-none"
          />
        </div>
      </Sheet>
    </div>
  );
}
