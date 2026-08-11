"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cancelMyOrder } from "@/lib/api/shop";
import { shopErrorMessage } from "@/lib/api/shop-errors";
import { createClient } from "@/lib/supabase/client";

/**
 * Cancel an order — the customer's only move in the order state machine.
 *
 * `set_order_status` allows exactly `new → cancelled` for a customer and refuses everything else
 * with *"you can only cancel an order while it is new"*. The page decides whether to render this at
 * all using `canCustomerCancel`, so the button's presence is the same claim the RPC will honour —
 * and when the salon marks it ready between the render and the press, `shopErrorMessage` turns that
 * race into a sentence about the salon rather than a failure.
 *
 * **Behind a confirm, because it cannot be undone.** `canOwnerTransition` has no path out of
 * `cancelled`, so a mis-tap costs the customer the order and the salon a notification. The confirm
 * says what happens next rather than asking "are you sure".
 */
export function OrderCancelButton({ orderId, code }: { orderId: string; code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      await cancelMyOrder(createClient(), orderId);
      setOpen(false);
      toast.success("Order cancelled. The salon has been told.");
      router.refresh();
    } catch (caught) {
      toast.error(shopErrorMessage("cancelOrder", caught));
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outlined" fullWidth onClick={() => setOpen(true)}>
        Cancel this order
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Cancel ${code}?`}
        footer={
          <div className="gap-sm flex flex-col">
            <Button fullWidth busy={busy} onClick={() => void cancel()}>
              Cancel the order
            </Button>
            <Button variant="quiet" fullWidth onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </div>
        }
      >
        <p className="text-body-md text-body">
          The salon will be told straight away, and this can&apos;t be undone — you would need to
          order again. Nothing has been charged either way.
        </p>
      </Sheet>
    </>
  );
}
