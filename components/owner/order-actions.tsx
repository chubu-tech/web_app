"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ownerErrorMessage, type OwnerAction } from "@/lib/api/owner-errors";
import { setOrderStatus } from "@/lib/api/owner-back-office";
import { canOwnerTransition } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { OrderFulfilment, OrderStatus } from "@/lib/types/back-office";

/**
 * Every forward move an owner can make, with the words for each.
 *
 * Order matters only in that at most one row is ever legal from a given status, so the filter
 * in `OrderActions` yields a single button — the table is a lookup, not a sequence.
 */
const MOVES: {
  target: OrderStatus;
  label: string;
  action: OwnerAction;
  done: string;
}[] = [
  {
    target: "ready",
    label: "Mark ready",
    action: "orderReady",
    done: "Marked ready — the customer knows.",
  },
  {
    target: "collected",
    label: "Mark collected",
    action: "orderCollected",
    done: "Collected. That's the lot.",
  },
  {
    target: "out_for_delivery",
    label: "Send out for delivery",
    action: "orderOutForDelivery",
    // The customer gets an `order_out_for_delivery` notification from this transition, which is
    // why the toast says so: it is the one move where pressing the button messages somebody.
    done: "On its way — the customer has been told.",
  },
  {
    target: "delivered",
    label: "Mark delivered",
    action: "orderDelivered",
    done: "Delivered. That's the lot.",
  },
];

/**
 * What an owner can do to an order — a port of the action half of
 * `tho/app/lib/business/shop/order_detail_screen.dart`.
 *
 * ## There is no Undo, and that is a fact about the state machine
 *
 * `set_order_status` allows `new → ready`, then either `ready → collected` or
 * `ready → out_for_delivery → delivered`, and `declined` from `new` or `ready`. Every one of
 * those is one-directional, and `collected` / `delivered` / `cancelled` / `declined` are
 * terminal — so `canOwnerTransition` is **never** true for a reverse move. The app reasons this
 * out in a comment and then shows a plain success toast; the same conclusion here, arrived at
 * the same way, which is why `canOwnerTransition` is imported rather than assumed: if the RPC
 * ever gains a reverse transition, this is where an Undo would appear.
 *
 * ## The buttons are derived from the state machine, not from a list of statuses
 *
 * Before the delivery statuses existed this rendered `status === "new"` and
 * `status === "ready"` as two hard-coded branches, and the terminal check asked
 * `canOwnerTransition(status, "ready")` — a question about one specific target. Both broke the
 * moment the lifecycle forked: a delivery order sitting at `ready` would have been offered
 * **Mark collected**, which the server refuses outright, and an `out_for_delivery` order would
 * have been declared finished while the driver was still on the road.
 *
 * So the moves are a table, each row filtered through `canOwnerTransition` with the order's own
 * fulfilment. There is exactly one place that knows what is legal, and it is the one that
 * mirrors the SQL.
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
export function OrderActions({
  orderId,
  status,
  fulfilment,
}: {
  orderId: string;
  status: OrderStatus;
  /**
   * Resolved by the page through `orderFulfilment`, so this is always one of the two lifecycles
   * and never a column read — the same default the server applies, applied once.
   */
  fulfilment: OrderFulfilment;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  const moves = MOVES.filter((m) => canOwnerTransition(status, m.target, fulfilment));
  const canDecline = canOwnerTransition(status, "declined", fulfilment);

  if (moves.length === 0 && !canDecline) {
    return (
      <p className="text-body-sm text-muted">
        This order is finished — nothing more to do on it.
      </p>
    );
  }

  async function move(target: OrderStatus, action: OwnerAction, note: string) {
    setBusy(true);
    try {
      await setOrderStatus(createClient(), orderId, target);
      toast.success(note);
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage(action, caught));
      /*
        **A lost race means the page is out of date, not that the press was wrong** — the same
        reasoning, and the same both-branches shape, as `queue-board.tsx`.

        Every one of these four actions gets *"That order was already dealt with. Refreshing."*
        for a `P0001`, and until this line nothing refreshed: the status stayed, the same button
        stayed, and the next press produced the identical toast for as long as the owner kept
        trying. The board gets away without an explicit refresh here only because it polls every
        four seconds; this page does not poll, so the sentence has to be kept by the caller.
      */
      router.refresh();
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
      // Same race, one status later: declining is legal from `new` and `ready` only, so an order
      // another till has already moved leaves this sheet open over a page that is now wrong. The
      // toast here is the server's own sentence rather than a promise to reload, which is the
      // only difference from `move` — the staleness is identical.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gap-sm flex flex-col">
      {moves.map((m) => (
        <Button
          key={m.target}
          fullWidth
          busy={busy}
          onClick={() => void move(m.target, m.action, m.done)}
        >
          {m.label}
        </Button>
      ))}
      {/*
        Declining is legal from `new` and `ready` only — the server refuses it once an order is
        out for delivery, because at that point the goods have left the shop. The button used to
        render unconditionally, which put a Decline on a page where it could only raise.
      */}
      {canDecline ? (
        <Button variant="outlined" fullWidth disabled={busy} onClick={() => setDeclining(true)}>
          Decline
        </Button>
      ) : null}

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
