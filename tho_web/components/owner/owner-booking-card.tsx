import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Icons, IconSize } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/status-pill";
import { THIMPHU_TZ } from "@/lib/time";
import { bookingCode, type Booking } from "@/lib/types/booking";
import { cn, formatNu } from "@/lib/utils";

/**
 * One row of the owner's day — a port of
 * `tho/app/lib/business/business_booking_card.dart`.
 *
 * **The customer's card and this one answer different questions**, which is why it is a
 * separate component rather than a variant. Theirs is shaped like a receipt and leads with
 * the salon; this leads with **who is coming and when**, because an owner is scanning a
 * column of twelve of them for the next name. Same reason the app keeps two widgets.
 *
 * The customer's name has three fallbacks, in the app's order: the linked profile's name,
 * then the name typed at the counter, then a label — `Walk-in` when the booking came from
 * the counter and `Guest` otherwise. A booking always has *someone*; what varies is how
 * much the salon knows about them.
 *
 * **`href` is a prop because the staff shell renders this too.** It used to hard-code
 * `/business/bookings/<id>`, which is inside the owner console — and `getStaffContext`
 * redirects an owner just as `getOwnerContext` redirects a stylist, so a linked staff
 * member clicking their own appointment would have been bounced out of their own shell.
 * Passing `null` renders the name as plain text instead of a link, which is what a surface
 * with no detail route wants. Same reason `SpecialistCard` takes an optional `href`.
 */
export function OwnerBookingCard({
  booking,
  href = `/business/bookings/${booking.id}`,
}: {
  booking: Booking;
  /** Where the card leads. `null` for a card that is not clickable. */
  href?: string | null;
}) {
  const dead = booking.status === "cancelled" || booking.status === "no_show";
  const tz = { timeZone: THIMPHU_TZ } as const;

  return (
    <article
      className={cn(
        "border-hairline bg-canvas relative rounded-md border",
        "p-base gap-base flex items-start",
        // Over-and-done rows recede rather than disappear: an owner still needs to see
        // that a cancellation happened, just not first.
        dead && "opacity-60",
      )}
    >
      <span className="w-14 shrink-0 text-center">
        <span className="text-title text-ink block font-semibold tabular-nums">
          {booking.startTs.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            ...tz,
          })}
        </span>
        <span className="text-caption-sm text-muted block tabular-nums">
          {totalMinutes(booking)} min
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="gap-sm flex items-start">
          <Avatar
            name={customerName(booking)}
            photoUrl={booking.customerAvatarUrl ?? null}
            size={36}
          />
          <span className="min-w-0 flex-1">
            <h3 className="text-title text-ink truncate font-semibold">
              {href ? (
                <Link
                  href={href}
                  className="after:absolute after:inset-0 after:content-['']"
                >
                  {customerName(booking)}
                </Link>
              ) : (
                customerName(booking)
              )}
            </h3>
            {servicesLine(booking) ? (
              <span className="text-body-sm text-muted block truncate">
                {servicesLine(booking)}
              </span>
            ) : null}
          </span>
          <StatusPill status={booking.status} />
        </span>

        <span className="mt-sm gap-md text-caption-sm text-muted flex items-center">
          <span className="gap-xxs flex items-center tabular-nums">
            <Icons.ticket
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              aria-hidden
            />
            {bookingCode(booking)}
          </span>
          {booking.customerNote ? (
            <span className="gap-xxs flex items-center" title="Has a note">
              <Icons.chat
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              Note
            </span>
          ) : null}
          {(booking.attachmentPaths?.length ?? 0) > 0 ? (
            <span className="gap-xxs flex items-center">
              <Icons.camera
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              {booking.attachmentPaths!.length}
            </span>
          ) : null}
          {booking.source === "walk_in" ? (
            <span className="gap-xxs flex items-center">
              <Icons.walkIn
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              Walk-in
            </span>
          ) : null}
          {booking.totalPrice > 0 ? (
            <span
              className={cn(
                "text-title ml-auto font-medium tabular-nums",
                dead ? "line-through" : "text-ink",
              )}
            >
              {formatNu(booking.totalPrice)}
            </span>
          ) : null}
        </span>
      </span>
    </article>
  );
}

/** The app's `customerDisplayName`, fallbacks in the same order. */
export function customerName(b: Booking): string {
  return b.customerName ?? (b.source === "walk_in" ? "Walk-in" : "Guest");
}

function totalMinutes(b: Booking): number {
  const items = b.items ?? [];
  if (items.length > 0) {
    return items.reduce((sum, it) => sum + it.durationMinutes, 0);
  }
  // No items embedded: fall back to the booking's own span, which is what
  // `create_booking` computed from those same services in the first place.
  return Math.max(0, Math.round((b.endTs.getTime() - b.startTs.getTime()) / 60_000));
}

/** "Haircut + Beard trim · with Sonam" — services first, stylist last. */
function servicesLine(b: Booking): string | null {
  const parts: string[] = [];
  const items = b.items ?? [];
  if (items.length > 0) parts.push(items.map((it) => it.name).join(" + "));
  if (b.staffName) parts.push(`with ${b.staffName}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
