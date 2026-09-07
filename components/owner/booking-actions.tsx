"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ActionHint } from "@/components/ui/action-hint";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cancelBooking } from "@/lib/api/booking";
import { reconcileBooking, setBookingStatus } from "@/lib/api/owner";
import { ownerErrorMessage, type OwnerAction } from "@/lib/api/owner-errors";
import { canFinalizeBooking, finalizeHintOrUnlocked } from "@/lib/booking-status-rules";
import { fullDayTimeLabel } from "@/lib/clock";
import { createClient } from "@/lib/supabase/client";
import type { Booking, BookingStatus } from "@/lib/types/booking";

/**
 * What the salon can do to a booking — a port of the action row in
 * `business_booking_detail_screen.dart`.
 *
 * **Which buttons exist is the server's rule, not a preference.**
 * `set_booking_status` accepts only `confirmed`, `completed` and `no_show`, and refuses any
 * booking whose current status is outside `pending`/`confirmed` with *"cannot transition
 * from % (booking is finalized)"*. So a finalized booking gets no buttons at all rather
 * than buttons that raise.
 *
 * **`pending` has no live example anywhere on the platform.** `create_booking` hard-codes
 * `status = 'confirmed'`, and there are zero `pending` rows in the database — so Confirm is
 * ported because the app has it and the enum allows it, but the only way to reach it is
 * `reconcile_booking`. Worth knowing before hunting for the bug that "Confirm never shows".
 *
 * **Complete and No-show are gated by time, and that is also the server's rule.**
 * `20260902000001_status_time_gate.sql` refuses both with P0017 until the appointment is
 * under way, because `completed` is what awards loyalty points, burns a pack credit and
 * counts as earned revenue in analytics, payroll and the tax estimate. Until then this
 * renders `ActionHint` in their place — the client hides them from `start_ts`, five minutes
 * stricter than the server, so no button here can be one the server refuses. `Cancel` stays
 * throughout: cancelling ahead of time is the one thing an owner legitimately does to a
 * future booking from this screen.
 *
 * **Cancel is a different call from the other three**, and Undo is a third. Cancelling
 * carries a reason and its own side effects (`cancel_booking`), and undoing it needs
 * `reconcile_booking` — the one RPC with no transition validation, which is exactly why it
 * can put a terminal booking back and why nothing else here uses it.
 */
export function BookingActions({ booking }: { booking: Booking }) {
  const router = useRouter();
  const [busy, setBusy] = useState<OwnerAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const status = booking.status;
  const live = status === "pending" || status === "confirmed";
  if (!live) return null;

  /*
    Read once per render rather than held in state. A booking whose start passes while this
    screen is open keeps the hint until something else re-renders — the app arms a timer for
    that moment; here the 4-second-poll surfaces around this one and the router refresh after
    any action cover it, and a stale "Complete in 1m" beside a working Cancel is a much
    smaller wrong than a timer leaking on every booking row.
  */
  const canFinalize = canFinalizeBooking(booking);

  async function transition(
    action: OwnerAction,
    next: Extract<BookingStatus, "confirmed" | "completed" | "no_show">,
    done: string,
  ) {
    setBusy(action);
    try {
      await setBookingStatus(createClient(), booking.id, next);
      toast.success(done);
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage(action, caught));
    } finally {
      setBusy(null);
    }
  }

  async function doCancel() {
    setBusy("cancelBooking");
    try {
      await cancelBooking(createClient(), booking.id, "cancelled by business");
      setConfirmOpen(false);
      // The status it goes back to, captured before the cancel — `reconcile_booking`
      // assigns whatever it is told, so it has to be told the right thing.
      const previous = status;
      toast.success("Booking cancelled.", {
        action: {
          label: "Undo",
          onClick: () => void undoCancel(previous),
        },
      });
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("cancelBooking", caught));
    } finally {
      setBusy(null);
    }
  }

  async function undoCancel(previous: BookingStatus) {
    try {
      await reconcileBooking(createClient(), booking.id, {
        reason: "undo cancel",
        status: previous,
      });
      toast.success("Booking restored.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("undoCancel", caught));
    }
  }

  return (
    <>
      <div className="gap-sm flex flex-wrap">
        {status === "pending" ? (
          <Button
            busy={busy === "confirmBooking"}
            disabled={busy != null}
            onClick={() => void transition("confirmBooking", "confirmed", "Booking confirmed.")}
          >
            Confirm booking
          </Button>
        ) : canFinalize ? (
          <Button
            busy={busy === "completeBooking"}
            disabled={busy != null}
            onClick={() => void transition("completeBooking", "completed", "Marked completed.")}
          >
            Mark completed
          </Button>
        ) : (
          <ActionHint>{finalizeHintOrUnlocked(booking)}</ActionHint>
        )}

        {status === "confirmed" && canFinalize ? (
          <Button
            variant="outlined"
            busy={busy === "noShowBooking"}
            disabled={busy != null}
            onClick={() => void transition("noShowBooking", "no_show", "Marked no-show.")}
          >
            No-show
          </Button>
        ) : null}

        <Button variant="quiet" disabled={busy != null} onClick={() => setConfirmOpen(true)}>
          Cancel booking
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
            <Button
              fullWidth
              busy={busy === "cancelBooking"}
              onClick={() => void doCancel()}
            >
              Cancel booking
            </Button>
          </div>
        }
      >
        <p className="text-body-md text-muted">
          The{" "}
          {fullDayTimeLabel(booking.startTs)}{" "}
          appointment will be cancelled. The customer is notified.
        </p>
      </Sheet>
    </>
  );
}
