"use client";

import { useMemo, useState } from "react";
import { OwnerBookingCard } from "@/components/owner/owner-booking-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { bookingTab, type Booking } from "@/lib/types/booking";

/**
 * A stylist's own appointments, segmented — a port of `StaffBookingsTab`
 * (`staff/staff_home.dart:97`).
 *
 * **Three things here are reuse rather than reimplementation**, which is the point:
 *
 * 1. `bookingTab()` is already the exact mapping the Dart's `_tabOf` does — pending and
 *    confirmed to Upcoming, completed to Completed, everything else to Cancelled. A second
 *    copy of that switch would have been a second thing to keep in step.
 * 2. `SegmentedControl` is the same control `BookingsList` uses, so the counts, the
 *    `role="tab"` semantics and the keyboard behaviour come for free.
 * 3. `OwnerBookingCard` is the card the app uses here too — `BusinessBookingCard`, not the
 *    customer's receipt-shaped one — because a stylist is scanning for **who is coming and
 *    when**, the owner's question, not "which salon was this".
 *
 * **`showStaff` has no equivalent and needs none.** The Dart passes `showStaff: false` to
 * suppress the stylist's own name on every row, which would otherwise repeat down the list.
 * `OwnerBookingCard` never renders the staff name at all, so there is nothing to switch off.
 *
 * **The cards do not link yet.** The app opens `BusinessBookingDetailScreen` from here, and
 * that screen's web equivalent lives at `/business/bookings/[id]` — inside the console, which
 * `getOwnerContext` closes to a stylist. A link would bounce them out of their own shell, so
 * `href={null}` renders the card as plain content until the staff-scoped detail route exists.
 * Nothing is broken by its absence; the row still carries the time, the customer, the
 * services, the total and the status.
 */
const LABELS = ["Upcoming", "Completed", "Cancelled"];

export function StaffBookings({ bookings }: { bookings: Booking[] }) {
  const [tab, setTab] = useState(0);

  const counts = useMemo(
    () => [0, 1, 2].map((t) => bookings.filter((b) => bookingTab(b) === t).length),
    [bookings],
  );
  const shown = useMemo(
    () => bookings.filter((b) => bookingTab(b) === tab),
    [bookings, tab],
  );

  return (
    <div>
      {/* The cap is written out rather than `max-w-md`, which resolves to
          `--spacing-md` — 12px. See the note in `components/ui/sheet.tsx`. */}
      <SegmentedControl
        label="Filter your bookings by status"
        labels={LABELS}
        counts={counts}
        index={tab}
        onChange={setTab}
        className="max-w-[28rem]"
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={tab === 2 ? Icons.bookingCancelled : Icons.bookingConfirmed}
          title={`No ${LABELS[tab]!.toLowerCase()} bookings`}
          message={
            tab === 0
              ? "Appointments booked with you will show up here."
              : `Your ${LABELS[tab]!.toLowerCase()} appointments will show here.`
          }
        />
      ) : (
        <ul className="gap-base mt-lg grid grid-cols-1 desktop:grid-cols-2">
          {shown.map((booking) => (
            <li key={booking.id}>
              <OwnerBookingCard booking={booking} href={null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
