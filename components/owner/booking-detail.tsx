import Link from "next/link";
import { BookingActions } from "@/components/owner/booking-actions";
import { Avatar } from "@/components/ui/avatar";
import { Icons, IconSize } from "@/components/ui/icons";
import { PhotoStrip } from "@/components/ui/photo-gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { THIMPHU_TZ } from "@/lib/time";
import { bookingCode, customerName, type Booking } from "@/lib/types/booking";
import { formatNu } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

/**
 * One booking as the salon sees it — a port of
 * `tho/app/lib/business/business_booking_detail_screen.dart`.
 *
 * **Two shells render this, which is why it is a component and not a page.** The app opens the
 * *same* screen from the owner's calendar and from a stylist's own list, and it has to: the
 * questions are identical — who is coming, what did they ask for, what does it cost, mark it
 * done. What differs is only **which booking you are allowed to open**, and that is a *read*
 * (`fetchBusinessBookingById` scopes by salon, `fetchStaffBookingById` by stylist), not a
 * layout. Same precedent as `OwnerBookingCard`, which the staff shell already reuses.
 *
 * It lives under `components/owner/` for that reason rather than because it is owner-only.
 *
 * **The actions are the same too, and that is the server's decision, not a convenience.**
 * `set_booking_status`, `cancel_booking` and `reconcile_booking` all authorise on
 * `private.is_business_member(business_id)`, which admits an active `staff_members.profile_id` —
 * checked against the live function bodies, not assumed. So a stylist marking their own
 * appointment completed is a write the database already accepts, which is what made the missing
 * staff route *a route to add rather than a permission to win*.
 *
 * One asymmetry worth knowing: `cancel_booking` skips the salon's own cancellation window for a
 * member (`if not v_is_member`), so a stylist cancelling is a *business* cancellation and is not
 * held to the customer's deadline.
 *
 * Two blocks the app has and this does not, both deferred with a reason rather than forgotten:
 * the loyalty balance with its Adjust action, and the payments ledger. There are **zero
 * `payments` rows** on the platform and `record_payment` requires Pro, which no salon has, so
 * both would ship with no way to see them work. `afterBill` is where the owner's page puts them
 * when that changes.
 */
export function BookingDetail({
  booking,
  photoUrls,
  back,
  afterBill,
}: {
  booking: Booking;
  /** Already signed — `booking_attachments.url` holds private object paths. */
  photoUrls: string[];
  /** Where the back link goes, and what it is called. The two shells differ only here. */
  back: { href: string; label: string };
  /**
   * Sections between the bill and the actions — the owner's payments ledger and points
   * adjustment, when those land. A stylist has no business with either, so it is a slot rather
   * than a flag.
   */
  afterBill?: React.ReactNode;
}) {
  const name = customerName(booking);
  const phone = booking.customerPhone ?? null;
  // Null for a number with no usable digits, which is why the WhatsApp link is gated on
  // this rather than on `phone` — a garbled number can still be dialled by a human but
  // cannot be turned into a `wa.me` address.
  const whatsapp = whatsappUrl(phone);
  const items = booking.items ?? [];

  return (
    <div className="px-base py-lg gap-lg mx-auto flex w-full max-w-[720px] flex-col tablet:px-lg">
      <Link
        href={back.href}
        className="text-title text-muted hover:text-ink gap-xs -ml-1 flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        {back.label}
      </Link>

      {/* ------------------------------------------------------------ who ---- */}
      <section className="gap-base flex items-start">
        <Avatar name={name} photoUrl={booking.customerAvatarUrl ?? null} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-md text-ink truncate font-medium">{name}</h1>
          {phone ? (
            <p className="text-body-sm text-muted tabular-nums">{phone}</p>
          ) : (
            <p className="text-body-sm text-muted">No phone number on file</p>
          )}
        </div>
        <StatusPill status={booking.status} />
      </section>

      {/* Reaching the customer. Both are plain links to the OS, which is the only thing
          that can actually place a call or open WhatsApp — the app's buttons do the same
          through `url_launcher`. Absent rather than disabled when there is no number:
          a walk-in typed in at the counter often has none. */}
      {phone ? (
        <section className="gap-sm flex flex-wrap">
          <a
            href={`tel:${phone}`}
            className="border-hairline text-title text-ink hover:bg-surface-soft gap-sm px-md flex min-h-12 items-center rounded-sm border font-medium"
          >
            <Icons.phone style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
            Call customer
          </a>
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="border-hairline text-title text-ink hover:bg-surface-soft gap-sm px-md flex min-h-12 items-center rounded-sm border font-medium"
            >
              <Icons.chat style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
              Message on WhatsApp
            </a>
          ) : null}
        </section>
      ) : null}

      {/* ----------------------------------------------------------- when ---- */}
      <section className="gap-sm flex flex-col">
        <Meta icon={Icons.booking}>
          {booking.startTs.toLocaleString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: THIMPHU_TZ,
          })}
        </Meta>
        {booking.staffName ? (
          <Meta icon={Icons.person}>with {booking.staffName}</Meta>
        ) : null}
        {booking.source === "walk_in" ? (
          <Meta icon={Icons.walkIn}>Walk-in</Meta>
        ) : null}
      </section>

      {/* ----------------------------------------------------------- note ---- */}
      {booking.customerNote ? (
        <section>
          <SectionHeader title="Customer note" as="h2" />
          <p className="bg-surface-soft p-base text-body-md text-ink mt-sm rounded-sm whitespace-pre-line">
            {booking.customerNote}
          </p>
        </section>
      ) : null}

      {/* --------------------------------------------------------- photos ---- */}
      {photoUrls.length > 0 ? (
        <section>
          <SectionHeader title="Reference photos" as="h2" />
          <div className="mt-sm">
            <PhotoStrip urls={photoUrls} />
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------- the bill ---- */}
      <section>
        <SectionHeader title="Services" as="h2" />
        <div className="border-hairline p-base mt-sm rounded-md border">
          <dl className="gap-sm flex flex-col">
            {items.length === 0 ? (
              <div className="flex items-baseline">
                <dt className="text-body-md text-ink flex-1">Appointment</dt>
                <dd className="text-body-md text-ink font-medium tabular-nums">
                  {formatNu(booking.totalPrice)}
                </dd>
              </div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="gap-sm flex items-baseline">
                  <dt className="text-body-md text-ink min-w-0 flex-1">
                    {it.name}
                    <span className="text-muted"> · {it.durationMinutes} min</span>
                  </dt>
                  <dd className="text-body-md text-ink font-medium tabular-nums">
                    {formatNu(it.price)}
                  </dd>
                </div>
              ))
            )}
          </dl>

          <div className="border-hairline-soft mt-base pt-base flex items-baseline border-t">
            <span className="text-title text-ink flex-1 font-semibold">Total</span>
            <span className="text-title text-ink font-semibold tabular-nums">
              {formatNu(booking.totalPrice)}
            </span>
          </div>

          <div className="mt-sm gap-sm flex items-baseline">
            <span className="text-caption-sm text-muted flex-1 tabular-nums">
              {bookingCode(booking)}
            </span>
            {/* The app's line, and still true: there is no payment rail in this product,
                and no `payments` row exists on the platform. */}
            <span className="text-caption-sm text-muted">Cash at the salon.</span>
          </div>
        </div>
      </section>

      {afterBill}

      <BookingActions booking={booking} />

      <FinalisedNote booking={booking} />
    </div>
  );
}

/**
 * Why a finished booking has no buttons.
 *
 * Without it the page just ends, and "where did Complete go?" is a fair question — the
 * server refuses any transition out of a terminal status, so saying so is better than
 * showing a control that would raise.
 */
function FinalisedNote({ booking }: { booking: Booking }) {
  if (booking.status === "pending" || booking.status === "confirmed") return null;
  return (
    <p className="text-body-sm text-muted">
      This booking is {booking.status === "no_show" ? "marked as a no-show" : booking.status}.
      Its status can no longer be changed here.
    </p>
  );
}

function Meta({
  icon: Icon,
  children,
}: {
  icon: typeof Icons.booking;
  children: React.ReactNode;
}) {
  return (
    <p className="text-body-md text-ink gap-sm flex items-start">
      <Icon
        className="text-rausch mt-0.5 shrink-0"
        style={{ width: IconSize.xs, height: IconSize.xs }}
        aria-hidden
      />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
