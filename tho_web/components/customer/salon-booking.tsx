"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SelectTile } from "@/components/ui/select-tile";
import { SectionHeader } from "@/components/ui/section-header";
import type { ServiceItem, StaffMember } from "@/lib/types/salon";
import { formatDuration, formatNu } from "@/lib/utils";

/**
 * Choosing a service and a stylist, ported from `_servicesTab` in
 * `tho/app/lib/customer/business_detail_screen.dart:577`.
 *
 * This selection belongs to the **salon page**, not the booking screen — the app
 * makes the same choice, and it is why `Book Appointment` is disabled until both
 * are picked (`business_detail_screen.dart:412`). 2b's booking screen is entered
 * with both already known.
 *
 * The CTA renders twice — in the desktop rail and in the mobile sticky bar — driven
 * by this one piece of state, so they can never disagree. The radio inputs render
 * once, since two groups sharing a `name` would fight.
 */
export function SalonBooking({
  salonId,
  services,
  staff,
  staffByService,
}: {
  salonId: string;
  services: ServiceItem[];
  staff: StaffMember[];
  /**
   * Who performs what, from `service_staff`.
   *
   * The two lists are **not** independent: `create_booking` refuses a pair that isn't
   * in this table, so offering every stylist for every service would let a customer
   * build a booking the server will reject — and on live data that is 2 of Norzin's 5
   * services, whose stylists perform none of them. The app has this gap; the fix is to
   * show only the stylists who can actually do the chosen service.
   */
  staffByService: Record<string, string[]>;
}) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  /** Only services someone can actually perform are offered at all. */
  const bookable = services.filter((s) => (staffByService[s.id]?.length ?? 0) > 0);
  const unbookable = services.length - bookable.length;

  const eligible = serviceId
    ? staff.filter((s) => staffByService[serviceId]?.includes(s.id))
    : staff;

  /** Changing service can invalidate the stylist — clear it rather than carry a pair
   *  the server would refuse. Done in the handler, not an effect. */
  function pickService(next: string) {
    setServiceId(next);
    if (staffId && !staffByService[next]?.includes(staffId)) setStaffId(null);
  }

  const ready = serviceId != null && staffId != null;
  const href = ready
    ? `/salon/${salonId}/book?service=${serviceId}&staff=${staffId}`
    : null;
  const missing = !serviceId
    ? staffId
      ? "Choose a service to continue"
      : "Choose a service and a stylist to continue"
    : !staffId
      ? "Choose a stylist to continue"
      : null;

  return (
    <>
      <div className="gap-lg flex flex-col">
        <section>
          <SectionHeader title="Choose a service" as="h3" />
          {bookable.length === 0 ? (
            <p className="text-body-sm text-muted">
              {services.length === 0
                ? "No services listed yet."
                : "No services are bookable online yet — call the salon to arrange one."}
            </p>
          ) : (
            <>
              <ServiceGroups
                services={bookable}
                selectedId={serviceId}
                onSelect={pickService}
              />
              {unbookable > 0 ? (
                <p className="text-caption-sm text-muted mt-sm">
                  {unbookable} more service{unbookable === 1 ? "" : "s"} at this salon
                  {unbookable === 1 ? " isn't" : " aren't"} bookable online yet.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section>
          <SectionHeader title="Choose a stylist" as="h3" />
          {eligible.length === 0 ? (
            <p className="text-body-sm text-muted">
              {staff.length === 0
                ? "No stylists listed yet."
                : "No stylist here performs that service — pick another."}
            </p>
          ) : (
            <ul className="gap-sm flex flex-col">
              {eligible.map((s) => (
                <li key={s.id}>
                  <SelectTile
                    name="staff"
                    value={s.id}
                    checked={staffId === s.id}
                    onSelect={setStaffId}
                    title={s.displayName}
                    subtitle={s.role}
                    media={<Avatar name={s.displayName} photoUrl={s.photoUrl} size={40} />}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="hidden desktop:block">
          <BookCta href={href} note={missing} />
        </div>
      </div>

      {/* The app's sticky bottom bar, kept below 1128 where the rail collapses. */}
      <div className="border-hairline bg-canvas p-base fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 border-t desktop:hidden">
        <BookCta href={href} note={missing} />
      </div>
    </>
  );
}

/**
 * A link once both choices are made, a disabled button with the reason until then.
 *
 * Disabled rather than hidden, and the reason names what is still missing — a control
 * that appears out of nowhere when you finish selecting is harder to trust than one
 * that has been telling you what it wants.
 */
function BookCta({ href, note }: { href: string | null; note: string | null }) {
  if (href) {
    return (
      <Link
        href={href}
        className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed flex min-h-12 items-center justify-center rounded-sm font-medium"
      >
        Book appointment
      </Link>
    );
  }
  return (
    <div>
      <Button fullWidth disabled aria-describedby="book-note">
        Book appointment
      </Button>
      <p id="book-note" className="text-caption-sm text-muted mt-xs text-center">
        {note}
      </p>
    </div>
  );
}

/**
 * Service tiles, grouped Women / Men / Unisex / Other — but **only when any service
 * carries a gender**, exactly as `_serviceTiles` does
 * (`business_detail_screen.dart:619`). 24 of 31 live services have none, so most
 * salons show a flat list and a set of empty group headings is avoided.
 */
function ServiceGroups({
  services,
  selectedId,
  onSelect,
}: {
  services: ServiceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tile = (s: ServiceItem) => (
    <li key={s.id}>
      <SelectTile
        name="service"
        value={s.id}
        checked={selectedId === s.id}
        onSelect={onSelect}
        title={s.name}
        subtitle={`${formatDuration(s.durationMinutes)} · ${formatNu(s.price)}`}
        media={
          s.imageUrl ? (
            <Avatar name={s.name} photoUrl={s.imageUrl} size={40} square />
          ) : undefined
        }
      />
    </li>
  );

  if (!services.some((s) => s.gender != null)) {
    return <ul className="gap-sm flex flex-col">{services.map(tile)}</ul>;
  }

  const ORDER: [string, string][] = [
    ["female", "Women"],
    ["male", "Men"],
    ["unisex", "Unisex"],
  ];
  const known = new Set(ORDER.map(([g]) => g));
  const rest = services.filter((s) => s.gender == null || !known.has(s.gender));

  return (
    <div className="gap-md flex flex-col">
      {ORDER.map(([gender, label]) => {
        const items = services.filter((s) => s.gender === gender);
        if (items.length === 0) return null;
        return (
          <div key={gender}>
            <GroupHeading>{label}</GroupHeading>
            <ul className="gap-sm flex flex-col">{items.map(tile)}</ul>
          </div>
        );
      })}
      {rest.length > 0 ? (
        <div>
          <GroupHeading>Other</GroupHeading>
          <ul className="gap-sm flex flex-col">{rest.map(tile)}</ul>
        </div>
      ) : null}
    </div>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-caption-sm text-muted mb-xs font-bold uppercase">{children}</p>
  );
}
