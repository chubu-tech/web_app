import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Icons, IconSize } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/status-pill";
import { hasFeature } from "@/lib/entitlements";
import { bookingCode, isActive, type Booking } from "@/lib/types/booking";
import { cn, formatNu } from "@/lib/utils";
import { ReminderToggle } from "./reminder-toggle";

/**
 * The three conditions for offering the reminder toggle. Exported so `/bookings/[id]` and
 * the card cannot disagree about when it appears.
 */
export function canRemind(booking: Booking): boolean {
  return (
    isActive(booking) &&
    booking.customerProfileId != null &&
    hasFeature(booking.businessPlan, "reminders")
  );
}

/**
 * The customer booking card, ported from
 * `tho/app/lib/customer/booking_rich_card.dart` — shaped like the e-receipt its
 * primary action promises. Three bands: a **status rail** down the left edge coloured
 * by lifecycle, so a list can be read without parsing any text; the **body**, anchored
 * by a date block; and a **stub** below a perforation carrying the code and total.
 *
 * The perforation is CSS — two radial notches and a dashed rule — rather than the
 * Dart's `CustomPainter`.
 *
 * **The "Remind me" toggle is ported, and the reason it was not is gone.** It used to write
 * `reminder_<bookingId>` to SharedPreferences with nothing anywhere reading it back — a
 * switch that remembered its own position and changed nothing. Since
 * `20260803000003_booking_reminder_mute` it is `bookings.reminders_muted`, server-owned, and
 * `private.enqueue_booking_reminders` refuses to enqueue for a muted booking; every reminder
 * branch of `handle_booking_status_event` routes through that one helper precisely so the
 * mute cannot be bypassed, which is also what makes it survive a reschedule.
 *
 * It renders only when all three hold, and each is a real case rather than caution:
 *
 * - **the booking is still active** — nothing to remind anyone about otherwise, matching the
 *   app's own `_upcoming` gate;
 * - **it has a customer** — `set_booking_reminders` raises `42501` when
 *   `customer_profile_id` is null, which is every walk-in, so the toggle is *absent* rather
 *   than present and doomed. Same rule Check in already follows;
 * - **the salon is on growth or pro** — below that `enqueue_booking_reminders` returns early,
 *   so the switch would save a genuine preference against something that never fires. Shown
 *   as nothing rather than as a locked control: a customer cannot upgrade someone else's
 *   salon, and which plan the shop is on is not their business.
 */
export function BookingCard({ booking }: { booking: Booking }) {
  const dead = booking.status === "cancelled" || booking.status === "no_show";
  const active = isActive(booking);

  // The rail carries the lifecycle before any text is read.
  const rail = dead
    ? "bg-muted-soft"
    : booking.status === "completed"
      ? "bg-success-text"
      : "bg-rausch";

  const relative = active ? relativeDay(booking.startTs) : null;
  const summary = servicesLine(booking);

  return (
    <article className="border-hairline bg-canvas shadow-card relative flex overflow-hidden rounded-md border">
      <span aria-hidden className={cn("w-1 shrink-0", rail)} />
      <div className="p-base min-w-0 flex-1">
        <div className="gap-sm flex items-center">
          <StatusPill status={booking.status} />
          {relative ? (
            <span className="bg-surface-soft text-badge text-ink px-sm py-xxs rounded-full font-semibold">
              {relative}
            </span>
          ) : null}
          {canRemind(booking) ? (
            <span className="ml-auto">
              <ReminderToggle
                bookingId={booking.id}
                initialMuted={booking.remindersMuted ?? false}
              />
            </span>
          ) : null}
        </div>

        <div className={cn("gap-md mt-md flex items-start", dead && "opacity-55")}>
          <DateBlock start={booking.startTs} dead={dead} />
          <div className="min-w-0 flex-1">
            <div className="gap-sm flex items-start">
              <h3 className="text-title text-ink min-w-0 flex-1 truncate font-semibold">
                <Link
                  href={`/bookings/${booking.id}`}
                  className="after:absolute after:inset-0 after:content-['']"
                >
                  {booking.businessName ?? "Salon"}
                </Link>
              </h3>
              <Avatar
                name={booking.businessName ?? "?"}
                photoUrl={booking.businessCoverUrl}
                size={36}
                square
              />
            </div>
            {summary ? (
              <MetaLine icon={Icons.haircut}>{summary}</MetaLine>
            ) : null}
            {booking.businessAddress ? (
              <MetaLine icon={Icons.location}>{booking.businessAddress}</MetaLine>
            ) : null}
          </div>
        </div>

        <Perforation />

        <div className="gap-sm flex items-center">
          <Icons.ticket
            className="text-muted shrink-0"
            style={{ width: IconSize.xxs, height: IconSize.xxs }}
            aria-hidden
          />
          <span className="text-caption-sm text-muted tabular-nums">
            {bookingCode(booking)}
          </span>
          {booking.totalPrice > 0 ? (
            <span
              className={cn(
                "text-title ml-auto font-medium tabular-nums",
                dead ? "text-muted line-through" : "text-ink",
              )}
            >
              {formatNu(booking.totalPrice)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** "Haircut + Beard trim · 45 min · with Tashi" from the booked items. */
function servicesLine(b: Booking): string | null {
  const parts: string[] = [];
  const items = b.items ?? [];
  if (items.length > 0) {
    parts.push(items.map((it) => it.name).join(" + "));
    const minutes = items.reduce((sum, it) => sum + it.durationMinutes, 0);
    if (minutes > 0) parts.push(`${minutes} min`);
  }
  if (b.staffName) parts.push(`with ${b.staffName}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * "Today" / "Tomorrow" / "In n days", within the next week.
 *
 * Compared as **Thimphu** calendar days, not the browser's: at 23:00 UTC it is already
 * tomorrow in Bhutan, and a card that says "Today" for an appointment that has moved
 * to tomorrow is worse than one that says nothing.
 */
function relativeDay(start: Date): string | null {
  const day = (d: Date) =>
    Math.floor((d.getTime() + 6 * 60 * 60_000) / 86_400_000);
  const days = day(start) - day(new Date());
  if (days < 0) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  return null;
}

/** Calendar-tile date. Fixed width so a column of cards aligns down the page. */
function DateBlock({ start, dead }: { start: Date; dead: boolean }) {
  const tz = { timeZone: "Asia/Thimphu" } as const;
  return (
    <div className="bg-surface-soft py-sm flex w-16 shrink-0 flex-col items-center rounded-sm">
      <span className="text-caption-sm text-muted font-semibold uppercase">
        {start.toLocaleDateString("en-GB", { weekday: "short", ...tz })}
      </span>
      <span
        className={cn(
          "text-display-sm font-semibold",
          dead ? "text-muted line-through" : "text-ink",
        )}
      >
        {start.toLocaleDateString("en-GB", { day: "numeric", ...tz })}
      </span>
      <span className="text-caption-sm text-muted font-semibold uppercase">
        {start.toLocaleDateString("en-GB", { month: "short", ...tz })}
      </span>
      <span className={cn("text-badge mt-xxs font-semibold", dead ? "text-muted" : "text-rausch")}>
        {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", ...tz })}
      </span>
    </div>
  );
}

/**
 * The tear line between the booking and its stub: a dashed rule with a notch bitten
 * out of each end, which is what makes the card read as a ticket rather than as one
 * more divider.
 */
function Perforation() {
  return (
    <div aria-hidden className="my-md relative h-3">
      <span className="border-hairline bg-canvas absolute -left-[calc(var(--spacing-base)+6px)] top-1/2 size-3 -translate-y-1/2 rounded-full border" />
      <span className="border-hairline bg-canvas absolute -right-[calc(var(--spacing-base)+6px)] top-1/2 size-3 -translate-y-1/2 rounded-full border" />
      <span className="border-hairline absolute inset-x-2 top-1/2 border-t border-dashed" />
    </div>
  );
}

function MetaLine({
  icon: Icon,
  children,
}: {
  icon: typeof Icons.haircut;
  children: React.ReactNode;
}) {
  return (
    <p className="text-body-sm text-muted mt-xxs gap-xs flex items-start">
      <Icon
        className="mt-0.5 shrink-0"
        style={{ width: IconSize.xxs, height: IconSize.xxs }}
        aria-hidden
      />
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}

// `StatusPill` moved to `components/ui/status-pill.tsx` in 3a — it is a port of
// `ui/widgets/status_pill.dart`, so it always belonged in the kit, and the owner console
// needed it without importing from `components/customer/`. Re-exported here so existing
// importers keep working.
export { StatusPill } from "@/components/ui/status-pill";
