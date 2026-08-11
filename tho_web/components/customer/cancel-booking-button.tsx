"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cancelBooking } from "@/lib/api/booking";
import { bookingErrorMessage } from "@/lib/api/booking-errors";
import { createClient } from "@/lib/supabase/client";
import type { Booking } from "@/lib/types/booking";

/**
 * Cancel a booking, with the confirmation the app puts in front of it.
 *
 * **Extracted so the card and the detail page share one implementation.** The card gained this
 * action to match `booking_rich_card.dart:329`, where Cancel sits on the row itself — cancelling
 * is the most common thing anybody does to a booking and it was two navigations deep here. The
 * alternative was a second copy of the confirm-and-cancel logic, which is how the two would
 * eventually come to disagree about whether a window had closed.
 *
 * Three things it has to get right, all of them the server's rules rather than this
 * component's:
 *
 * - **P0015.** Past the salon's cancellation window `cancel_booking` refuses, and
 *   `bookingErrorMessage` turns that into the salon's own hour count. On the detail page the
 *   button is *disabled* before the press, because that page has read the business and knows
 *   the window; the card has not, so here the server is what says no. Fail-open in the same
 *   direction as everywhere else: offer the action, let the RPC decide.
 * - **The confirm names the appointment**, because a list of cards makes "are you sure" an
 *   ambiguous question.
 * - **A refresh, not local state.** The status rail, the segment counts and the pill all come
 *   from the server, so the row has to be re-read rather than patched.
 */
export function CancelBookingButton({
  booking,
  /** `outlined` on the detail page's stack, `quiet` on a card where it sits beside a link. */
  variant = "outlined",
  fullWidth = false,
  /** Set on the detail page, where the window is known and the control is disabled instead. */
  disabled = false,
}: {
  booking: Pick<Booking, "id" | "startTs" | "businessName">;
  variant?: "outlined" | "quiet";
  fullWidth?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await cancelBooking(createClient(), booking.id);
      setOpen(false);
      toast.success("Booking cancelled.");
      router.refresh();
    } catch (caught) {
      toast.error(bookingErrorMessage(caught, "Couldn't cancel."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        fullWidth={fullWidth}
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
        className="text-error-text relative z-10"
      >
        Cancel booking
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Cancel booking?">
        <div className="p-base gap-md flex flex-col">
          <p className="text-body-md text-body">
            Your{" "}
            {booking.startTs.toLocaleString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Thimphu",
            })}{" "}
            appointment at {booking.businessName ?? "the salon"} will be cancelled.
          </p>
          <Button variant="filled" fullWidth busy={busy} onClick={() => void confirm()}>
            Cancel booking
          </Button>
          <Button variant="outlined" fullWidth disabled={busy} onClick={() => setOpen(false)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </>
  );
}
