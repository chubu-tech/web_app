"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { bookingTab, type Booking } from "@/lib/types/booking";
import { BookingCard } from "./booking-card";

/**
 * My bookings, ported from `_MyBookings` in
 * `tho/app/lib/customer/customer_home.dart:809`.
 *
 * The split is by **status, not by date** (`bookingTab`) — so a confirmed appointment
 * whose time has passed but which nobody has completed still reads as Upcoming. That
 * is the honest answer: as far as the salon's own records go, it is still live.
 */
const LABELS = ["Upcoming", "Completed", "Cancelled"];

export function BookingsList({ bookings, now }: { bookings: Booking[]; now: Date }) {
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
        label="Filter bookings by status"
        labels={LABELS}
        counts={counts}
        index={tab}
        onChange={setTab}
        className="max-w-[28rem]"
      />

      {shown.length === 0 ? (
        tab === 0 ? (
          <EmptyState
            icon={Icons.bookingConfirmed}
            title="No upcoming appointments"
            message="Book a salon and it will show up here."
            action={
              <Link
                href="/"
                className="border-hairline text-title text-ink hover:bg-surface-soft inline-flex min-h-12 items-center rounded-sm border px-4 font-medium"
              >
                Explore salons
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={tab === 1 ? Icons.bookingConfirmed : Icons.bookingCancelled}
            title="Nothing here"
            message={
              tab === 1
                ? "Completed appointments will show here."
                : "Cancelled appointments will show here."
            }
            /*
              The app's own action (`customer_home.dart:1364`), and it was the one thing this
              state was missing. An empty archive is a dead end otherwise: "Explore salons"
              would be the wrong offer — somebody on the Completed tab is looking for a history,
              and the useful move is the tab that has something in it. It switches the segment
              rather than navigating, because the list is already here.
            */
            action={
              counts[0]! > 0 ? (
                <Button variant="outlined" onClick={() => setTab(0)}>
                  View upcoming
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <ul className="gap-base mt-lg grid grid-cols-1 desktop:grid-cols-2">
          {shown.map((booking) => (
            <li key={booking.id}>
              <BookingCard booking={booking} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
