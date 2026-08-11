"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { checkInBooking } from "@/lib/api/queue";
import { checkInErrorMessage } from "@/lib/api/queue-errors";
import { createClient } from "@/lib/supabase/client";
import { canRemind, type Booking } from "@/lib/types/booking";
import { cn } from "@/lib/utils";
import { CancelBookingButton } from "./cancel-booking-button";
import { ReminderToggle } from "./reminder-toggle";
import { ReviewBookingButton } from "./review-booking-button";

/**
 * The actions on a booking: check in, reschedule, cancel, or review it.
 *
 * Which ones appear is decided by the booking's own state, exactly as in
 * `booking_detail_screen.dart:417`.
 */
export function BookingActions({
  booking,
  alreadyReviewed,
  cancellationNote,
  checkIn,
}: {
  booking: Booking;
  alreadyReviewed: boolean;
  /**
   * What the salon's own window allows, stated before the button rather than
   * discovered as an RPC rejection. Computed on the server — see the page.
   */
  cancellationNote: { text: string; closed: boolean } | null;
  /**
   * Whether this salon runs a walk-in line at all, and what its check-in window
   * allows — both resolved on the server, since only the page knows the salon.
   *
   * `null` means no queue here, and the button is **absent** rather than present and
   * doomed. That is a deliberate departure from the app, which offers it on every
   * active booking and lets the RPC explain: on live data that fails at 10 of 13
   * salons, and worse, `check_in_booking` gates on the *plan* alone — so at a Growth
   * salon whose owner switched the queue off, the app's button **succeeds** and drops
   * the customer into a line whose board nobody opens. Waiting for a turn that will
   * never be called is not an error the customer can read.
   */
  checkIn: { open: boolean; note: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = booking.status === "pending" || booking.status === "confirmed";
  const canReview =
    booking.status === "completed" && booking.businessId != null && !alreadyReviewed;

  /**
   * Hand this booking to the shop's line.
   *
   * Idempotent server-side: an already-checked-in booking returns its existing entry,
   * so a second press lands on the same place rather than creating a second one.
   */
  async function doCheckIn() {
    setBusy(true);
    try {
      const entry = await checkInBooking(createClient(), booking.id);
      router.push(`/queue/${entry.id}`);
    } catch (caught) {
      toast.error(checkInErrorMessage(caught));
      setBusy(false);
    }
  }

  if (!active && !canReview) return null;

  return (
    <div className="gap-sm mt-lg flex flex-col">
      {/*
        The reminder switch, which the app's detail screen does not have — it only puts one
        on the card. A deliberate addition rather than an oversight the other way: the detail
        page is where somebody who wants to change one booking's settings goes, and a list
        item is a poor place to hunt for a control. `canRemind` lives in
        `lib/types/booking.ts` so this and the card cannot disagree about when it is offered.
      */}
      {canRemind(booking) ? (
        <div className="border-hairline-soft p-md flex items-center justify-between rounded-sm border">
          <span className="text-body-sm text-body">
            Text and push reminders before this appointment
          </span>
          <ReminderToggle
            bookingId={booking.id}
            initialMuted={booking.remindersMuted ?? false}
          />
        </div>
      ) : null}

      {active && cancellationNote ? (
        <p
          className={cn(
            "text-body-sm text-ink p-md gap-sm flex items-start rounded-sm",
            cancellationNote.closed ? "bg-error-soft" : "bg-surface-soft",
          )}
        >
          {cancellationNote.closed ? (
            <Icons.error
              className="text-error-text mt-0.5 shrink-0"
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
          ) : (
            <Icons.info
              className="text-muted mt-0.5 shrink-0"
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
          )}
          {cancellationNote.text}
        </p>
      ) : null}

      {/* The window, stated before the button — the same courtesy the cancellation
          note above already extends, and for the same reason: "check-in opens 2 hours
          before your appointment" is more use as a fact than as a rejection. */}
      {active && checkIn ? (
        <>
          <p
            className={cn(
              "text-body-sm text-ink p-md gap-sm flex items-start rounded-sm",
              checkIn.open ? "bg-success-soft" : "bg-surface-soft",
            )}
          >
            <Icons.queue
              className={cn("mt-0.5 shrink-0", checkIn.open ? "text-success-text" : "text-muted")}
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            {checkIn.note}
          </p>
          <Button
            variant="outlined"
            fullWidth
            disabled={!checkIn.open || busy}
            onClick={doCheckIn}
          >
            I&apos;m here — check in
          </Button>
        </>
      ) : null}

      {active ? (
        <>
          {/*
            Past the cutoff both self-service actions are **disabled rather than removed**,
            with the reason stated directly above them — a control that vanishes reads as a
            bug, and the note is what turns a dead button into an explanation. Reschedule is
            included because moving an appointment an hour before it starts costs the salon
            the same empty chair as cancelling it, which is why `reschedule_booking` raises
            P0015 too.

            Check-in above is deliberately untouched: turning up is exactly what somebody
            inside the window is supposed to do.

            This is the half that was missing. The note has been rendered since the page was
            built, and until `20260807000032` it was the only thing
            `cancellation_window_hours` changed anywhere — a salon set 12 hours, one sentence
            appeared, and the Cancel button directly beneath it still cancelled, free and
            unrecorded.

            **It fails open.** A failed `fetchBusinessById` leaves `cancellationNote` null, so
            nothing is disabled and the server has the last word (P0015, mapped with the
            salon's own hour count). Disabling on a failed read would strand a customer who
            could legitimately cancel.
          */}
          {cancellationNote?.closed ? (
            <Button variant="filled" fullWidth disabled>
              Reschedule
            </Button>
          ) : (
            <Link
              href={`/bookings/${booking.id}/reschedule`}
              className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed flex min-h-12 items-center justify-center rounded-sm font-medium"
            >
              Reschedule
            </Link>
          )}
          {/* The shared control — the card uses the same one. Disabled here rather than
              server-refused, because this page HAS read the business and knows the window. */}
          <CancelBookingButton
            booking={booking}
            fullWidth
            disabled={busy || cancellationNote?.closed === true}
          />
        </>
      ) : null}

      {canReview ? <ReviewBookingButton booking={booking} fullWidth /> : null}


    </div>
  );
}
