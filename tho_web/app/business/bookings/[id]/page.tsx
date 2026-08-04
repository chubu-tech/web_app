import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingActions } from "@/components/owner/booking-actions";
import { customerName } from "@/components/owner/owner-booking-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { Avatar } from "@/components/ui/avatar";
import { Icons, IconSize } from "@/components/ui/icons";
import { PhotoStrip } from "@/components/ui/photo-gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { signedBookingMediaUrls } from "@/lib/api/booking";
import { fetchBusinessBookingById } from "@/lib/api/owner";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { THIMPHU_TZ } from "@/lib/time";
import { bookingCode, type Booking } from "@/lib/types/booking";
import { formatNu } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Booking" };

/**
 * One booking, the salon's side — a port of
 * `tho/app/lib/business/business_booking_detail_screen.dart`.
 *
 * **The read is scoped to the active salon**, not just to the booking id. `bookings_select`
 * OR-matches the customer or *any* business member, so an owner of nine salons asking for a
 * bare id would be handed a booking from whichever of their shops it belonged to, under a
 * header naming the shop they are currently looking at. Passing `business_id` means the
 * page 404s instead — and the same query is what refuses another salon's booking outright.
 *
 * Two blocks the app has and this does not, both **3c**: the loyalty balance with its
 * Adjust action, and the payments ledger. Neither is deferred for difficulty — there are
 * **zero `payments` rows** on the platform and `record_payment` requires Pro, which no
 * salon has, so both would ship with no way to see them work.
 */
export default async function OwnerBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const { id } = await params;
  const supabase = await createClient();

  const booking = await fetchBusinessBookingById(supabase, active.id, id);
  if (!booking) notFound();

  // Private bucket: `booking_attachments.url` holds object *paths*, and they need signing
  // before `next/image` can render them. A failed signing costs the strip, not the page.
  const photoUrls = await signedBookingMediaUrls(
    supabase,
    booking.attachmentPaths ?? [],
  ).catch(() => [] as string[]);

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
        href="/business"
        className="text-title text-muted hover:text-ink gap-xs -ml-1 flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        Calendar
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
