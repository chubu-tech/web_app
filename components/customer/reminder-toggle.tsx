"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setBookingReminders } from "@/lib/api/booking";
import { bookingErrorMessage } from "@/lib/api/booking-errors";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * "Remind me" for one booking.
 *
 * ## The reason this was not ported is gone
 *
 * Until `20260803000003_booking_reminder_mute` the app's switch wrote
 * `reminder_<bookingId>` to `SharedPreferences` and **nothing read it back** — so it was a
 * control that changed nothing, and porting it would have been the same dishonesty as
 * promising a notification nothing sends. It is now `bookings.reminders_muted`,
 * server-owned, and `private.enqueue_booking_reminders` returns early on it. That is also
 * what makes a mute survive a reschedule, which is the regression that migration exists for.
 *
 * ## Optimistic, and it rolls back
 *
 * The switch moves first because it is the thing under the finger, and a rejected write puts
 * it back — showing "off" while the outbox still holds a pending reminder is the exact lie
 * this control used to tell. Same pattern and same reasoning as `FavouriteButton`.
 *
 * **The revert path finally has something to catch.**
 * `20260807000024_reminders_require_plan` made `set_booking_reminders` raise `P0001` when
 * *enabling* at a salon whose plan does not send reminders — before that it succeeded and
 * enqueued nothing, so there was no failure for this to roll back. `canRemind` hides the
 * switch on those salons, which means reaching this branch is a stale tab or a query that
 * lost the plan embed; either way `bookingErrorMessage` passes the server's own sentence
 * through ("This salon does not send appointment reminders.") rather than blaming the network
 * for a fact about the salon. Muting is allowed at every plan, so the refusal is one-sided:
 * only the promise is gated, never the withdrawal of one.
 *
 * No `router.refresh()` on success: the row and the local state already agree, and a refresh
 * would re-fetch a whole list to change one boolean.
 *
 * ## A real switch
 *
 * `role="switch"` on a real checkbox rather than a styled `<div>`, per the kit's rule that
 * new controls are real elements. There is no `Switch` in `components/ui` yet; one call site
 * does not justify a primitive, so promote it if a second appears.
 */
export function ReminderToggle({
  bookingId,
  initialMuted,
}: {
  bookingId: string;
  /** `bookings.reminders_muted` — note the toggle shows its inverse. */
  initialMuted: boolean;
}) {
  const [on, setOn] = useState(!initialMuted);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      try {
        // `next` is what the customer now sees, which is exactly what the RPC takes —
        // it stores the inverse itself.
        await setBookingReminders(createClient(), bookingId, next);
      } catch (caught) {
        setOn(!next);
        toast.error(
          bookingErrorMessage(caught, "Couldn't save your reminder setting."),
        );
      }
    });
  }

  return (
    <label
      className={cn(
        "gap-sm inline-flex cursor-pointer items-center select-none",
        // The booking card's title is a stretched link (`after:absolute after:inset-0`), so
        // anything inside the card is underneath it and unclickable without this.
        "relative z-10",
        pending && "opacity-60",
      )}
    >
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={pending}
        onChange={toggle}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[var(--duration-fast)]",
          "peer-focus-visible:outline-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          on ? "bg-rausch-cta" : "bg-surface-strong",
        )}
      >
        <span
          className={cn(
            "bg-canvas absolute top-0.5 size-5 rounded-full shadow-sm transition-all duration-[var(--duration-fast)]",
            on ? "left-[1.125rem]" : "left-0.5",
          )}
        />
      </span>
      <span className="text-caption text-muted font-medium">Remind me</span>
    </label>
  );
}
