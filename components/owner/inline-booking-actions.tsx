"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cancelBooking } from "@/lib/api/booking";
import { reconcileBooking, setBookingStatus } from "@/lib/api/owner";
import { ownerErrorMessage, type OwnerAction } from "@/lib/api/owner-errors";
import { createClient } from "@/lib/supabase/client";
import { THIMPHU_TZ } from "@/lib/time";
import type { Booking, BookingStatus } from "@/lib/types/booking";

/**
 * Confirm / Complete / No-show / Cancel **on the card**, so a day can be run without opening
 * twelve pages — a port of `calendar_tab.dart:178-281`.
 *
 * This was the biggest daily-ergonomics gap in the console: every transition needed the detail
 * page, so finishing a busy morning meant twelve round trips through a route whose only purpose
 * was to hold four buttons. The app has had them on the agenda card since the beginning.
 *
 * ## The optimistic flip is one card's, and the card owns it
 *
 * `calendar-view.tsx` receives its bookings from the server and has no list state to mutate —
 * the selected day lives in the URL and the fetching is the page's. So rather than lift a copy
 * of the day's bookings into client state just to flip one field, `OwnerBookingCard` holds the
 * flipped status for itself and this reports into it through `onOptimistic`. The split is: **the
 * card owns what is displayed, this owns what is in flight.** Both have to move together or the
 * pill would say Confirmed beside a Complete button that had already succeeded.
 *
 * On success `router.refresh()` re-runs the server component and the real row arrives carrying
 * the same value, so there is nothing to reconcile and no flicker. On failure the override is
 * dropped and the prop shows through again.
 *
 * That is the same guarantee the Dart gets from `copyWith` on its own list, without a second
 * source of truth for the whole day.
 *
 * ## Which buttons appear is the server's rule
 *
 * `set_booking_status` takes only `confirmed`/`completed`/`no_show` and refuses anything already
 * outside `pending`/`confirmed`, so a finished booking gets **no** row rather than a row that
 * raises. Cancelling is its own RPC and Undo is a third — `reconcile_booking`, the only call
 * with no transition validation, which is why it can put a cancelled booking back.
 *
 * **Cancel keeps its confirmation even here.** A one-tap destructive action in a list of twelve
 * near-identical rows is the wrong trade; the app shows an `AlertDialog` for the same reason, and
 * the Undo on the success toast is the second line of defence rather than the first.
 */
export function InlineBookingActions({
  booking,
  status,
  onOptimistic,
}: {
  booking: Booking;
  /** What the card is showing — the override if there is one, else the row's own status. */
  status: BookingStatus;
  /**
   * Show a status before the server confirms it, or `null` to go back to the row.
   *
   * Never cleared on success: the refresh brings the same value, so clearing would open a
   * window where the pill flips back for one frame.
   */
  onOptimistic: (status: BookingStatus | null) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<OwnerAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const live = status === "pending" || status === "confirmed";
  if (!live) return null;

  async function transition(
    action: OwnerAction,
    next: Extract<BookingStatus, "confirmed" | "completed" | "no_show">,
    done: string,
  ) {
    const previous = status;
    setBusy(action);
    onOptimistic(next);
    try {
      await setBookingStatus(createClient(), booking.id, next);
      toast.success(done);
      router.refresh();
    } catch (caught) {
      // Back to the row's own status when that is where it came from, and back to the earlier
      // override when a previous action had already moved it.
      onOptimistic(previous === booking.status ? null : previous);
      toast.error(ownerErrorMessage(action, caught));
    } finally {
      setBusy(null);
    }
  }

  async function doCancel() {
    // Captured before the flip: `reconcile_booking` assigns whatever it is told, so Undo has
    // to be told the status this booking actually had.
    const previous = status;
    setBusy("cancelBooking");
    onOptimistic("cancelled");
    try {
      await cancelBooking(createClient(), booking.id, "cancelled by business");
      setConfirmOpen(false);
      toast.success("Booking cancelled.", {
        action: { label: "Undo", onClick: () => void undoCancel(previous) },
      });
      router.refresh();
    } catch (caught) {
      onOptimistic(null);
      toast.error(ownerErrorMessage("cancelBooking", caught));
    } finally {
      setBusy(null);
    }
  }

  async function undoCancel(previous: BookingStatus) {
    onOptimistic(previous);
    try {
      await reconcileBooking(createClient(), booking.id, {
        reason: "undo cancel",
        status: previous,
      });
      toast.success("Booking restored.");
      router.refresh();
    } catch (caught) {
      onOptimistic("cancelled");
      toast.error(ownerErrorMessage("undoCancel", caught));
    }
  }

  return (
    <>
      {/*
        `relative z-10` because `OwnerBookingCard`'s title link covers the whole card with an
        `after:inset-0` pseudo-element — the trick that makes the row clickable. Without a
        stacking context above it every one of these buttons would open the detail page instead
        of firing, which is the same class of bug the carousel's pointer capture caused.
      */}
      <div className="gap-sm mt-sm relative z-10 flex flex-wrap">
        {status === "pending" ? (
          <Button
            className="min-h-9 px-3"
            busy={busy === "confirmBooking"}
            disabled={busy != null}
            onClick={() => void transition("confirmBooking", "confirmed", "Booking confirmed.")}
          >
            Confirm
          </Button>
        ) : (
          <Button
            className="min-h-9 px-3"
            busy={busy === "completeBooking"}
            disabled={busy != null}
            onClick={() => void transition("completeBooking", "completed", "Marked completed.")}
          >
            Complete
          </Button>
        )}

        {status === "confirmed" ? (
          <Button
            variant="outlined"
            className="min-h-9 px-3"
            busy={busy === "noShowBooking"}
            disabled={busy != null}
            onClick={() => void transition("noShowBooking", "no_show", "Marked no-show.")}
          >
            No-show
          </Button>
        ) : null}

        <Button
          variant="quiet"
          className="min-h-9 px-3"
          disabled={busy != null}
          onClick={() => setConfirmOpen(true)}
        >
          Cancel
        </Button>
      </div>

      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel booking?"
        footer={
          <div className="gap-sm flex">
            <Button variant="outlined" fullWidth onClick={() => setConfirmOpen(false)}>
              Keep it
            </Button>
            <Button fullWidth busy={busy === "cancelBooking"} onClick={() => void doCancel()}>
              Cancel booking
            </Button>
          </div>
        }
      >
        <p className="text-body-md text-muted">
          The{" "}
          {booking.startTs.toLocaleString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: THIMPHU_TZ,
          })}{" "}
          appointment will be cancelled. The customer is notified.
        </p>
      </Sheet>
    </>
  );
}
