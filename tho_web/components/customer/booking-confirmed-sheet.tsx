"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { thimphuMinutesOfDay, formatMinutesOfDay } from "@/lib/time";
import type { Business, ServiceItem, StaffMember } from "@/lib/types/salon";

/**
 * The moment the customer app exists for, ported from
 * `tho/app/lib/customer/booking_confirmed_sheet.dart`.
 *
 * **It stays until it is dismissed.** That is the whole point and it is a fix, not a
 * preference: it replaced a 4-second snackbar shown while the booking screen was
 * already being popped out from under it, so the one thing that had to reassure the
 * customer vanished before it could, and nothing on screen recorded what had just been
 * booked. A first-timer had to go and find Bookings to learn whether it had worked.
 *
 * Do not regress this to a toast.
 *
 * Everything needed to trust the booking is here: who, what, when, where, and how to
 * get out of it.
 */
export function BookingConfirmedSheet({
  open,
  bookingId,
  business,
  service,
  staff,
  start,
  onDone,
}: {
  open: boolean;
  bookingId: string;
  business: Business;
  service: ServiceItem;
  staff: StaffMember;
  start: Date;
  onDone: () => void;
}) {
  // Thimphu, not the browser's zone — the time the customer will actually turn up at.
  const when = start.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Thimphu",
  });
  const time = formatMinutesOfDay(thimphuMinutesOfDay(start));

  return (
    <Sheet open={open} onClose={onDone} title="You're booked">
      <div className="p-base">
        <div className="flex flex-col items-center text-center">
          <span className="bg-rausch/10 flex size-16 items-center justify-center rounded-full">
            <Icons.success
              className="text-rausch-cta"
              style={{ width: IconSize.xl, height: IconSize.xl }}
              aria-hidden
            />
          </span>
          <p className="text-title text-ink mt-base font-semibold">
            {when} at {time}
          </p>
        </div>

        <dl className="border-hairline-soft divide-hairline-soft mt-lg divide-y border-y">
          <Row icon={Icons.haircut} label="Service" value={service.name} />
          <Row icon={Icons.person} label="Stylist" value={staff.displayName} />
          <Row icon={Icons.salon} label="Salon" value={business.name} />
          {business.addressText ? (
            <Row icon={Icons.location} label="Where" value={business.addressText} />
          ) : null}
        </dl>

        <p className="text-body-sm text-muted mt-md">
          Free to reschedule or cancel from My bookings up to{" "}
          {business.cancellationWindowHours} hours before.
        </p>

        <div className="gap-sm mt-lg flex flex-col">
          <Link
            href={`/bookings/${bookingId}`}
            className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed flex min-h-12 items-center justify-center rounded-sm font-medium"
          >
            View booking
          </Link>
          <Button variant="outlined" fullWidth onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Icons.salon;
  label: string;
  value: string;
}) {
  return (
    <div className="py-md gap-md flex items-center">
      <Icon
        className="text-muted shrink-0"
        style={{ width: IconSize.sm, height: IconSize.sm }}
        aria-hidden
      />
      <dt className="sr-only">{label}</dt>
      <dd className="text-body-md text-ink min-w-0">{value}</dd>
    </div>
  );
}
