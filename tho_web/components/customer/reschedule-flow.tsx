"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rescheduleBooking } from "@/lib/api/booking";
import { bookingErrorMessage } from "@/lib/api/booking-errors";
import { createClient } from "@/lib/supabase/client";
import { formatMinutesOfDay, thimphuMinutesOfDay } from "@/lib/time";
import type { Slot } from "@/lib/types/booking";
import { SlotPicker } from "./slot-picker";

/**
 * Move a booking to a new time, ported from
 * `tho/app/lib/customer/reschedule_screen.dart`.
 *
 * Same staff and same services — `reschedule_booking` re-runs the availability and
 * clash checks server-side, so this deliberately does **not** re-apply
 * `blockForSlot`: the booking being moved is itself in the customer's list, and
 * warning them that they already have a booking at that time would be describing the
 * very booking they are moving.
 */
export function RescheduleFlow({
  bookingId,
  staffId,
  serviceIds,
}: {
  bookingId: string;
  staffId: string;
  serviceIds: string[];
}) {
  const router = useRouter();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function confirm() {
    if (!slot) return;
    setBusy(true);
    try {
      await rescheduleBooking(createClient(), bookingId, slot.start);
      toast.success(
        `Rescheduled to ${formatMinutesOfDay(thimphuMinutesOfDay(slot.start))}.`,
      );
      router.refresh();
      router.replace(`/bookings/${bookingId}`);
    } catch (caught) {
      toast.error(
        bookingErrorMessage(
          caught,
          "Couldn't reschedule — the slot may have just been taken.",
        ),
      );
      setSlot(null);
      setReloadKey((k) => k + 1);
      setBusy(false);
    }
  }

  return (
    <>
      <SlotPicker
        staffId={staffId}
        serviceIds={serviceIds}
        selected={slot}
        onSelect={setSlot}
        disabled={busy}
        reloadKey={reloadKey}
      />

      {slot ? (
        <div className="border-hairline bg-canvas p-base fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 border-t tablet:bottom-0">
          <div className="mx-auto max-w-[720px]">
            <Button fullWidth busy={busy} onClick={confirm}>
              Move to {formatMinutesOfDay(thimphuMinutesOfDay(slot.start))}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
