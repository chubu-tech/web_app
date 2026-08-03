"use client";

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
  services,
  staff,
}: {
  services: ServiceItem[];
  staff: StaffMember[];
}) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  const missing = !serviceId
    ? staffId
      ? "Choose a service to continue"
      : "Choose a service and a stylist to continue"
    : !staffId
      ? "Choose a stylist to continue"
      : "Booking arrives with the next update";

  return (
    <>
      <div className="gap-lg flex flex-col">
        <section>
          <SectionHeader title="Choose a service" as="h3" />
          {services.length === 0 ? (
            <p className="text-body-sm text-muted">No services listed yet.</p>
          ) : (
            <ServiceGroups
              services={services}
              selectedId={serviceId}
              onSelect={setServiceId}
            />
          )}
        </section>

        <section>
          <SectionHeader title="Choose a stylist" as="h3" />
          {staff.length === 0 ? (
            <p className="text-body-sm text-muted">No stylists listed yet.</p>
          ) : (
            <ul className="gap-sm flex flex-col">
              {staff.map((s) => (
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
          <BookCta note={missing} />
        </div>
      </div>

      {/* The app's sticky bottom bar, kept below 1128 where the rail collapses. */}
      <div className="border-hairline bg-canvas p-base fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 border-t desktop:hidden">
        <BookCta note={missing} />
      </div>
    </>
  );
}

function BookCta({ note }: { note: string }) {
  return (
    <div>
      {/* Disabled throughout 2a: the route it leads to is 2b's. The change there
          is one line — `disabled` becomes `disabled={!ready}` and the button
          becomes a link to `/salon/[id]/book?service=…&staff=…`. Shipping it
          pressable now would mean a CTA that goes nowhere, which is worse than a
          CTA that says why it is waiting. */}
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
