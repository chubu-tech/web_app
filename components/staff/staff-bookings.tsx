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
 * **The cards link now.** This note used to explain why they could not: the app opens
 * `BusinessBookingDetailScreen` from here, and its web equivalent existed only at
 * `/business/bookings/[id]`, which `getOwnerContext` closes to a stylist — so `href={null}`
 * rendered the card as plain content rather than bouncing them out of their own shell. That was
 * a real gap dressed up as a design choice: the row carried the time and the customer but a
 * stylist could not complete their own appointment, mark a no-show, read the note or phone
 * anyone, while `set_booking_status` would have accepted every one of those writes.
 * `/staff/bookings/[id]` is the route that was missing.
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
              <OwnerBookingCard booking={booking} href={`/staff/bookings/${booking.id}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
