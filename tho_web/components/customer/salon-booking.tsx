"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SelectTile } from "@/components/ui/select-tile";
import { SectionHeader } from "@/components/ui/section-header";
import { bookableServices } from "@/lib/booking-basket";
import type { ServiceItem } from "@/lib/types/salon";
import { formatDuration, formatNu } from "@/lib/utils";

/**
 * The salon page's rail: pick a service, then go and book it.
 *
 * ## The stylist picker moved into the flow, and this is what is left
 *
 * This was two pickers — a service *and* a stylist — because `/salon/[id]/book` could not
 * be entered without both and 404'd on a pair `service_staff` did not carry. The flow
 * chooses both now, on its own steps, with "Any professional" as a real option that this
 * rail could never offer. Keeping a second stylist picker here would mean two places to
 * make one choice, and the one on this page would be the one that could not say
 * "whoever is free".
 *
 * What stays is the shortcut: tick a service, press Book, arrive at step 1 with it
 * already in the basket. `?service=` *seeds* the flow rather than fixing it, so this is
 * a head start and not a commitment.
 *
 * The CTA renders twice — in the desktop rail and in the mobile sticky bar — driven by
 * this one piece of state, so they can never disagree. The radio inputs render once,
 * since two groups sharing a `name` would fight.
 */
export function SalonBooking({
  salonId,
  services,
  staffByService,
  initialServiceId = null,
}: {
  salonId: string;
  services: ServiceItem[];
  /**
   * The service the price list handed over, from `?service=`.
   *
   * **Validated by the caller, not trusted here** — the page checks it against
   * `staffByService` before passing it, so a hand-edited id cannot preselect a service
   * this salon does not perform and leave the stylist list empty with no explanation.
   *
   * It is an *initial* value: once the rail is on screen the radio group owns the
   * selection, and the page remounts this component when the parameter changes (see the
   * `key` at the call site). Reading the URL on every render instead would fight the
   * visitor — picking a different service in the rail would be undone by the parameter
   * that is still in the address bar.
   */
  initialServiceId?: string | null;
  /**
   * Who performs what, from `service_staff` — the authority on what is bookable.
   *
   * Used here only to drop services nobody performs, which on live data is 2 of Norzin's
   * 5. The *stylist* half of this table is the flow's business now.
   */
  staffByService: Record<string, string[]>;
}) {
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);

  /** Only services someone can actually perform are offered at all. */
  const bookable = bookableServices(services, staffByService);
  const unbookable = services.length - bookable.length;

  // No stylist in the href: the flow asks for one, and it can offer "any professional",
  // which is not a value this rail could produce.
  const href = serviceId ? `/salon/${salonId}/book?service=${serviceId}` : null;
  const missing = serviceId ? null : "Choose a service to continue";

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
                onSelect={setServiceId}
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

        <div className="hidden desktop:block">
          <BookCta href={href} note={missing} />
        </div>
      </div>

      {/*
        The app's sticky bottom bar, kept below 1128 where the rail collapses.

        `desktop:hidden` (1128) is about the rail, a different axis from the chrome — and
        it used to combine badly with the old `62px` offset, which only came off at
        `tablet:` (744). Between those two widths the bar floated 62px above the bottom
        over empty space. `bottom-0` at every width fixes that as a side effect.
      */}
      <div className="border-hairline bg-paper p-base pb-[calc(var(--spacing-base)+env(safe-area-inset-bottom))] fixed inset-x-0 bottom-0 z-20 border-t desktop:hidden">
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
