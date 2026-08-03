import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingActions } from "@/components/customer/booking-actions";
import { StatusPill } from "@/components/customer/booking-card";
import { CoverImage } from "@/components/ui/cover-image";
import { ActionCircle, HeroCircleButton, IconLine } from "@/components/ui/detail-bits";
import { Icons } from "@/components/ui/icons";
import { PhotoStrip } from "@/components/ui/photo-gallery";
import { SectionHeader } from "@/components/ui/section-header";
import {
  fetchBookingById,
  fetchBookingPayments,
  fetchMyReviewedBookingIds,
  signedBookingMediaUrls,
} from "@/lib/api/booking";
import { fetchBusinessById } from "@/lib/api/discovery";
import { createClient } from "@/lib/supabase/server";
import {
  bookingCode,
  hasNote,
  isActive,
  outstandingNu,
  type Payment,
} from "@/lib/types/booking";
import { hasLocation, travels } from "@/lib/types/salon";
import { formatNu } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Booking" };

/**
 * One booking, ported from `tho/app/lib/customer/booking_detail_screen.dart`.
 *
 * Like the salon page, **every optional piece is caught on its own** — the salon, the
 * payments and the signed photo URLs. A failed read costs an affordance, never the
 * page.
 */
export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS scopes this to the caller's own bookings, so a stranger's id is simply not
  // found — no separate ownership check needed here.
  const booking = await fetchBookingById(supabase, id);
  if (!booking) notFound();

  const [business, payments, photoUrls, reviewedIds] = await Promise.all([
    booking.businessId
      ? fetchBusinessById(supabase, booking.businessId).catch(() => null)
      : null,
    fetchBookingPayments(supabase, id).catch(() => [] as Payment[]),
    // Private bucket: these are object paths and need signing before they render.
    signedBookingMediaUrls(supabase, booking.attachmentPaths ?? []).catch(() => []),
    fetchMyReviewedBookingIds(supabase).catch(() => new Set<string>()),
  ]);

  const wa = business
    ? whatsappUrl(
        business.whatsappPhone,
        `Hi, about my booking ${bookingCode(booking)}.`,
      )
    : null;

  /**
   * Whether free cancellation has already closed, per the salon's own window.
   *
   * The clock is read **here**, on the server. This page reads cookies, so it is
   * always rendered per request and never cached — "now" is genuinely now. The
   * react-hooks/purity rule below cannot distinguish a server component from a client
   * one; in a client render this would be a real bug, which is why the suppression is
   * this narrow.
   */
  const active = isActive(booking);
  let cancellationNote: { text: string; closed: boolean } | null = null;
  if (active && business) {
    const freeUntil = new Date(
      booking.startTs.getTime() - business.cancellationWindowHours * 3_600_000,
    );
    // eslint-disable-next-line react-hooks/purity
    const closed = Date.now() > freeUntil.getTime();
    cancellationNote = {
      closed,
      text: closed
        ? "Free cancellation has closed for this booking. Call the salon if you need to change it."
        : `Free until ${freeUntil.toLocaleString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Thimphu",
          })}.`,
    };
  }

  const outstanding = outstandingNu(booking.totalPrice, payments);

  return (
    <div>
      {booking.businessCoverUrl ? (
        <div className="relative">
          <CoverImage
            label={booking.businessName ?? "Salon"}
            imageUrl={booking.businessCoverUrl}
            sizes="100vw"
            priority
            className="h-[160px] w-full tablet:h-[220px]"
          />
          <div className="px-base pt-base absolute inset-x-0 top-0 tablet:px-lg">
            <HeroCircleButton icon={Icons.back} label="Back to my bookings" href="/bookings" />
          </div>
        </div>
      ) : null}

      <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
        <div className="gap-md flex items-start">
          <h1 className="text-display-sm text-ink flex-1 font-semibold">
            {booking.businessName ?? "Salon"}
          </h1>
          <StatusPill status={booking.status} />
        </div>

        <div className="mt-md gap-xxs flex flex-col">
          <IconLine icon={Icons.booking}>
            {booking.startTs.toLocaleString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Thimphu",
            })}
          </IconLine>
          {booking.staffName ? (
            <IconLine icon={Icons.person}>with {booking.staffName}</IconLine>
          ) : null}
          {booking.businessAddress ? (
            <IconLine icon={Icons.location}>{booking.businessAddress}</IconLine>
          ) : null}
          {booking.source === "walk_in" ? (
            <IconLine icon={Icons.queue}>Walk-in</IconLine>
          ) : null}
        </div>

        {/* Reaching the salon is what you actually want from a booking when you're
            running late, and the app had no way to do it from here until it was added. */}
        {business ? (
          <div className="gap-base mt-lg flex overflow-x-auto pb-1">
            {business.phone ? (
              <ActionCircle
                icon={Icons.phone}
                label="Call"
                href={`tel:${business.phone.replace(/\s/g, "")}`}
              />
            ) : null}
            {wa ? <ActionCircle icon={Icons.send} label="WhatsApp" href={wa} external /> : null}
            {hasLocation(business) && !travels(business) ? (
              <ActionCircle
                icon={Icons.nearMe}
                label="Directions"
                href={`https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`}
                external
              />
            ) : null}
          </div>
        ) : null}

        {hasNote(booking) ? (
          <section className="mt-lg">
            <SectionHeader title="Your note" as="h2" />
            <p className="bg-surface-soft p-base text-body-md text-ink rounded-md">
              {booking.customerNote}
            </p>
          </section>
        ) : null}

        {photoUrls.length > 0 ? (
          <section className="mt-lg">
            <SectionHeader title="Photos you attached" as="h2" />
            <PhotoStrip urls={photoUrls} size={92} />
          </section>
        ) : null}

        <section className="mt-lg">
          <SectionHeader title="Receipt" as="h2" />
          <div className="border-hairline p-base rounded-md border">
            <dl>
              {(booking.items ?? []).map((item) => (
                <div key={item.id} className="mb-sm flex items-baseline justify-between gap-4">
                  <dt className="text-body-md text-body">
                    {item.name} · {item.durationMinutes} min
                  </dt>
                  <dd className="text-body-md text-ink tabular-nums">
                    {formatNu(item.price)}
                  </dd>
                </div>
              ))}
              <div className="border-hairline-soft pt-sm flex items-baseline justify-between gap-4 border-t">
                <dt className="text-title text-ink font-semibold">Total</dt>
                <dd className="text-title text-ink font-semibold tabular-nums">
                  {formatNu(booking.totalPrice)}
                </dd>
              </div>

              {/* Real payments when the salon recorded any, instead of asserting
                  "paid in cash" for every booking regardless of what happened. */}
              {payments.length > 0 ? (
                <div className="border-hairline-soft mt-sm pt-sm border-t">
                  {payments.map((p) => (
                    <div key={p.id} className="mb-xs flex items-baseline justify-between gap-4">
                      <dt className="text-body-sm text-muted">{paymentLabel(p)}</dt>
                      <dd
                        className={
                          p.kind === "refund"
                            ? "text-body-sm text-error-text tabular-nums"
                            : "text-body-sm text-success-text tabular-nums"
                        }
                      >
                        {formatNu(p.amountNu)}
                      </dd>
                    </div>
                  ))}
                  {outstanding > 0 ? (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-title text-ink font-medium">Still to pay</dt>
                      <dd className="text-title text-ink font-medium tabular-nums">
                        {formatNu(outstanding)}
                      </dd>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-caption-sm text-muted mt-xs">Pay at the salon.</p>
              )}
            </dl>
          </div>
        </section>

        <BookingActions
          booking={booking}
          alreadyReviewed={reviewedIds.has(booking.id)}
          cancellationNote={cancellationNote}
        />
      </div>
    </div>
  );
}

function paymentLabel(p: Payment): string {
  const kind =
    p.kind === "deposit" ? "Deposit" : p.kind === "refund" ? "Refund" : "Payment";
  const when = p.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Thimphu",
  });
  return `${kind} · ${p.method} · ${when}`;
}
