"use client";

import { useEffect, useRef } from "react";
import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { RatingPill } from "@/components/ui/rating";
import { basketTotal } from "@/lib/booking-basket";
import { formatMinutesOfDay, thimphuMinutesOfDay } from "@/lib/time";
import type { Business, ServiceItem, StaffMember } from "@/lib/types/salon";
import { cn, formatDuration, formatNu } from "@/lib/utils";

/**
 * The running order — Fresha's right-hand card, and the one thing on screen at every
 * step of the flow.
 *
 * It answers "what am I about to buy" continuously rather than at a review step, which
 * is the substantive difference between this flow and the one it replaced: that one put
 * the service and stylist on the *previous page*, showed a slot grid with a price in the
 * button, and revealed everything else in a modal at the end.
 *
 * ## Two shapes, one component, and it is not a media query on the same markup
 *
 * At `desktop` (1128) and up it is a sticky card in a second column. Below that there is
 * no column to put it in, so it becomes a fixed bar carrying the total and the action —
 * the itemisation is on the page above it at that width, and repeating it in a bar would
 * cover the list it summarises.
 *
 * The **action is a slot**, not a prop pair. Each step names its own next move
 * ("Continue", "Book Nu 150") and owns the disabled reason for it, and passing a label
 * plus a handler plus a disabled flag plus a busy flag is four props that describe one
 * button.
 */
export function BookingSummary({
  business,
  services,
  staff,
  start,
  action,
  note,
}: {
  business: Business;
  /** The basket, in the order it was built. */
  services: ServiceItem[];
  /** The chosen stylist, or null for "any professional" / not yet chosen. */
  staff: StaffMember | null;
  /** The chosen slot's start, once there is one. */
  start: Date | null;
  action: React.ReactNode;
  /** A blocking or cautionary line, shown above the action. */
  note?: React.ReactNode;
}) {
  const total = basketTotal(services);

  /*
    **The page's clearance under this bar is measured, not assumed.**

    `--cta-clearance` is 96px and `app/globals.css` says what that is: "p-base twice + min-h-12 +
    a note line. A floor rather than a measurement." One note line was the true worst case while
    `note` held at most one element — and it stopped being true when the confirm step started
    passing a `Notice` **and** the cancellation term together, deliberately. On a 390px phone a
    multi-line block warning plus that paragraph plus the total row plus the button clears 200px,
    and the page went on reserving 96, so the bar covered the bottom of the very step it belongs
    to.

    A `ResizeObserver` on the bar publishes its real height, and the booking page pads by that
    with the constant as the fallback — so server-rendered and pre-hydration output is exactly
    what it is today, and anything added to this bar in future is accounted for without another
    constant being re-derived by hand. Its own name, not `--cta-clearance`: the shared token is
    read by other fixed bars, and one component must not redefine the floor for all of them.

    No state, so this never re-renders — it writes a custom property and cleans it up.
  */
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    // Only write when the number actually moved. The property is resolved by the page
    // container's bottom padding, so every `setProperty` on `body` invalidates style for the
    // whole page — and the observer fires on ticks where the height is unchanged, which on iOS
    // is every address-bar collapse, because the bar's height includes `env(safe-area-inset-
    // bottom)`. The height itself only changes when this bar gains or loses a line.
    let published = -1;
    const publish = () => {
      const height = bar.offsetHeight;
      if (height === published) return;
      published = height;
      document.body.style.setProperty("--booking-cta-clearance", `${height}px`);
    };
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      document.body.style.removeProperty("--booking-cta-clearance");
    };
  }, []);

  return (
    <>
      {/* The desktop card. `sticky` with the header's own height as the offset, so it
          settles under the fixed chrome rather than behind it. */}
      <aside className="hidden desktop:block">
        <div className="border-hairline-soft bg-paper shadow-card p-lg sticky top-[calc(var(--header-height)+var(--spacing-lg))] rounded-lg border">
          <Identity business={business} />

          {start ? <When start={start} services={services} /> : null}

          <Items services={services} staff={staff} start={start} />

          <div className="border-hairline-soft mt-base pt-base flex items-center border-t">
            <span className="text-title text-ink flex-1 font-semibold">Total</span>
            <span className="text-title text-ink font-semibold tabular-nums">
              {formatNu(total)}
            </span>
          </div>

          {note ? <div className="mt-base">{note}</div> : null}
          <div className="mt-lg">{action}</div>
        </div>
      </aside>

      {/*
        The phone and tablet bar. `pb` carries the safe-area inset as *padding* rather
        than as an offset, so the fill still reaches the bottom edge and only the content
        clears the iOS home indicator — the same shape every other fixed bar in this app
        uses, and the reason none of them float above a gap on an iPhone.
      */}
      <div
        ref={barRef}
        className="border-hairline bg-paper p-base pb-[calc(var(--spacing-base)+env(safe-area-inset-bottom))] fixed inset-x-0 bottom-0 z-30 border-t desktop:hidden"
      >
        <div className="mx-auto w-full max-w-[720px]">
          {note ? <div className="mb-sm">{note}</div> : null}
          <div className="gap-base flex items-center">
            <div className="min-w-0 flex-1">
              <p className="text-title text-ink font-semibold tabular-nums">
                {formatNu(total)}
              </p>
              <p className="text-caption-sm text-muted truncate">
                {services.length === 0
                  ? "Nothing selected yet"
                  : `${services.length} service${services.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="shrink-0">{action}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function Identity({ business }: { business: Business }) {
  return (
    <div className="gap-base border-hairline-soft pb-base flex border-b">
      <span className="size-16 shrink-0 overflow-hidden rounded-md">
        {/* `size-full` on the CoverImage itself: its own box has no height, so a sized
            wrapper alone leaves the `fill` image collapsed to nothing. */}
        <CoverImage
          label={business.name}
          imageUrl={business.coverUrl}
          sizes="64px"
          className="size-full"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-title text-ink font-semibold">{business.name}</p>
        {business.reviewCount > 0 ? (
          <RatingPill rating={business.avgRating} count={business.reviewCount} />
        ) : null}
        {business.addressText ? (
          <p className="text-body-sm text-muted mt-xxs">{business.addressText}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The appointment, once there is one.
 *
 * The end time is computed from the basket's own duration rather than read off the slot:
 * a slot's `end` is what `compute_availability` returned for the whole basket, and both
 * agree — but stating it as *"12:00–12:25 (25 min duration)"* needs the duration anyway,
 * so it is derived once here rather than in two places.
 */
function When({ start, services }: { start: Date; services: ServiceItem[] }) {
  const minutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const from = thimphuMinutesOfDay(start);

  return (
    <div className="border-hairline-soft gap-sm py-base flex flex-col border-b">
      <Line icon={Icons.booking}>
        {start.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "Asia/Thimphu",
        })}
      </Line>
      <Line icon={Icons.clock}>
        {formatMinutesOfDay(from)}–{formatMinutesOfDay(from + minutes)} (
        {formatDuration(minutes)})
      </Line>
    </div>
  );
}

function Line({
  icon: Icon,
  children,
}: {
  icon: (typeof Icons)[keyof typeof Icons];
  children: React.ReactNode;
}) {
  return (
    <p className="text-body-sm text-ink gap-sm flex items-center">
      <Icon
        className="text-muted shrink-0"
        style={{ width: IconSize.xs, height: IconSize.xs }}
        aria-hidden
      />
      {children}
    </p>
  );
}

function Items({
  services,
  staff,
  start,
}: {
  services: ServiceItem[];
  staff: StaffMember | null;
  start: Date | null;
}) {
  if (services.length === 0) {
    return (
      <p className="text-body-sm text-muted py-base">
        Pick a service to get started.
      </p>
    );
  }

  return (
    <ul className={cn("gap-base flex flex-col", start ? "pt-base" : "py-base")}>
      {services.map((s) => (
        <li key={s.id} className="gap-base flex items-start">
          <div className="min-w-0 flex-1">
            <p className="text-body-sm text-ink font-medium">{s.name}</p>
            <p className="text-caption text-muted">
              {formatDuration(s.durationMinutes)} with{" "}
              {/* "any professional" until somebody is chosen — the same words the
                  professional step offers, so the summary never claims a stylist the
                  customer has not picked. */}
              <span className={staff ? "text-rausch-cta" : undefined}>
                {staff ? staff.displayName : "any professional"}
              </span>
            </p>
          </div>
          <span className="text-body-sm text-ink shrink-0 tabular-nums">
            {formatNu(s.price)}
          </span>
        </li>
      ))}
    </ul>
  );
}
