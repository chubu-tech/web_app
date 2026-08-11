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
import { cancellationWindow } from "@/lib/booking-guards";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  bookingCode,
  hasNote,
  isActive,
  outstandingNu,
  paymentLine,
  relativeDayLabel,
  type Payment,
} from "@/lib/types/booking";
import { hasLocation, runsQueue, travels } from "@/lib/types/salon";
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

  // **RLS is not a scope here, and assuming it was is the same mistake
  // `fetchMyBookings` made.** `bookings_select` OR-matches the customer *or* a
  // business member, so a salon owner or staff member reaching this URL would be
  // handed one of their own salon's bookings — a customer's name, phone and note —
  // rendered as if it were their own appointment, with a Cancel button that
  // `cancel_booking` would honour. The owner's view of the same row is
  // `/business/bookings/[id]`, which says whose side you are on.
  //
  // Same refusal, and the same reason, as `/messages/[id]`.
  const [account, booking] = await Promise.all([
    getAccount(),
    fetchBookingById(supabase, id),
  ]);
  if (!booking) notFound();
  if (booking.customerProfileId !== account.user?.id) notFound();

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
   * always rendered per request and never cached — "now" is genuinely now. Note that
   * `react-hooks/purity` does not flag `new Date()` passed straight into a call the way it
   * flags one assigned and then read, so nothing lints this: in a *client* component it
   * would be a real bug and the linter would be silent about it.
   *
   * The decision itself is `cancellationWindow` in `lib/booking-guards.ts`, shared with
   * `/bookings/[id]/reschedule` — the two must not disagree about the same booking, and
   * since `20260807000032` the answer disables two controls rather than only choosing a
   * sentence.
   */
  const active = isActive(booking);
  const windowState = active
    ? cancellationWindow({
        startTs: booking.startTs,
        windowHours: business?.cancellationWindowHours,
        now: new Date(),
      })
    : null;
  const cancellationNote = windowState
    ? {
        closed: windowState.closed,
        text: windowState.closed
          ? "Free cancellation has closed for this booking. Call the salon if you need to change it."
          : `Free until ${windowState.freeUntil.toLocaleString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Thimphu",
            })}.`,
      }
    : null;

  /**
   * The check-in window, per `20260731000002_queue_checkin_window_and_locking.sql`:
   * it opens 2 hours before `start_ts` and closes 1 hour after `end_ts`.
   *
   * Computed here so the page can *state* it rather than let the customer discover it
   * as a P0004 rejection — the same treatment the cancellation window above gets, and
   * the same narrow `purity` suppression for the same reason: this page reads cookies,
   * so it is always rendered per request and "now" is genuinely now.
   *
   * `null` — no button at all — when the salon runs no queue. `runsQueue` is stricter
   * than the RPC, which gates on the plan alone; see `BookingActions` for why that
   * difference matters.
   */
  let checkIn: { open: boolean; note: string } | null = null;
  if (active && business && runsQueue(business)) {
    const opensAt = new Date(booking.startTs.getTime() - 2 * 3_600_000);
    const closesAt = new Date(booking.endTs.getTime() + 3_600_000);
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const open = now >= opensAt.getTime() && now <= closesAt.getTime();
    checkIn = {
      open,
      note: open
        ? "You can check in now — this adds you to the shop's line ahead of walk-ins."
        : now < opensAt.getTime()
          ? `Check-in opens ${opensAt.toLocaleString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Thimphu",
            })}.`
          : "This appointment is too old to check in.",
    };
  }

  const outstanding = outstandingNu(booking.totalPrice, payments);
  /* Same helper the card uses, same clock discipline — `lib/types/booking.ts`. */
  const relative = active ? relativeDayLabel(booking.startTs, new Date()) : null;

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
          {/*
            The relative chip the card has and this page did not
            (`booking_detail_screen.dart:308`). It is the fastest thing to read on a receipt
            somebody opened to check *when* — "In 3 days" answers that before the date line
            below has been parsed. Null past a week and for anything already gone, so a
            completed booking gets a status pill and nothing else.
          */}
          {relative ? (
            <span className="bg-surface-soft text-badge text-ink px-sm py-xxs shrink-0 rounded-full font-semibold">
              {relative}
            </span>
          ) : null}
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
                      <dt className="text-body-sm text-muted">
                        {paymentLine(p, "Asia/Thimphu")}
                      </dt>
                      <dd
                        className={
                          p.kind === "refund"
                            ? "text-body-sm text-error-text tabular-nums"
                            : "text-body-sm text-success-text tabular-nums"
                        }
                      >
                        {/* `Math.abs` with an explicit sign: `amount_nu` is stored negative
                            for a refund, so the raw value renders "Nu -150" — a minus buried
                            inside the currency string. The colour already says which
                            direction; the sign makes the column add up. */}
                        {p.kind === "refund"
                          ? `−${formatNu(Math.abs(p.amountNu))}`
                          : formatNu(p.amountNu)}
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
          checkIn={checkIn}
        />
      </div>
    </div>
  );
}

