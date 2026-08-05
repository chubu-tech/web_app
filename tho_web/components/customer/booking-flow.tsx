"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { GuestWall } from "@/components/auth/guest-wall";
import {
  addBookingAttachments,
  createBooking,
  deleteBookingPhotos,
  fetchMyBookings,
  setBookingHairstyle,
  uploadBookingPhoto,
} from "@/lib/api/booking";
import { bookingErrorMessage, isGuestRefusal } from "@/lib/api/booking-errors";
import { blockForSlot, bookingBlockMessage, travelWarning } from "@/lib/booking-guards";
import { hasFeature } from "@/lib/entitlements";
import { resolveLocation } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { formatMinutesOfDay, thimphuMinutesOfDay } from "@/lib/time";
import type { Booking, Slot } from "@/lib/types/booking";
import { hasLocation, type Business, type ServiceItem, type StaffMember } from "@/lib/types/salon";
import { distanceKm } from "@/lib/booking-guards";
import { cn, formatNu } from "@/lib/utils";
import { BookingConfirmedSheet } from "./booking-confirmed-sheet";
import { BookingExtrasSheet, type BookingExtras } from "./booking-extras-sheet";
import { SlotPicker } from "./slot-picker";

/**
 * The signed-in person's own bookings, or an empty list when nobody is signed in.
 *
 * `fetchMyBookings` needs the id explicitly, because `bookings_select` OR-matches
 * business membership and would otherwise hand a salon owner their whole book. Resolving
 * the user here also means an anonymous visitor makes no query at all — they have no
 * history for the overlap guard to consider.
 */
async function myBookingsFor(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return fetchMyBookings(supabase, user.id);
}

/**
 * Pick a time and book it, ported from `tho/app/lib/customer/booking_screen.dart`.
 *
 * The confirm order matters and is the app's (`booking_screen.dart:122`): re-check the
 * block, then the guest wall, then the extras sheet, then `create_booking`, then the
 * two best-effort follow-ups, then a confirmation that stays on screen. Each step
 * exists because doing it later cost something.
 */
export function BookingFlow({
  business,
  service,
  staff,
  isGuest,
}: {
  business: Business;
  service: ServiceItem;
  staff: StaffMember;
  /** True with no session or an anonymous one — either way, the wall applies. */
  isGuest: boolean;
}) {
  const router = useRouter();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [km, setKm] = useState<number | null>(null);
  const [wallOpen, setWallOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string; start: Date } | null>(null);

  /**
   * `null` when the extras sheet is closed; a fresh number each time it opens.
   *
   * Used as its `key`, so every opening gets a brand-new component with an empty note
   * and no photos. That is cheaper and more obviously correct than clearing five
   * pieces of state, and it means an abandoned attempt cannot leak into the next one.
   */
  const [extrasSession, setExtrasSession] = useState<number | null>(null);

  /**
   * One key per confirm attempt, held across retries.
   *
   * `create_booking` catches its own unique violation and returns the booking the key
   * already made, so reusing it turns a double-click or a retry into the *same*
   * booking. Minting a fresh key per press is exactly what would produce two.
   */
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    // Best-effort: the server enforces the same rules, so a failure here just means
    // it does the rejecting instead of us warning first.
    myBookingsFor(createClient())
      .then((list) => {
        if (live) setMyBookings(list);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLocation(business)) return;
    let live = true;
    resolveLocation().then((fix) => {
      // Only a real fix earns a travel warning. Measuring from the Thimphu fallback
      // would tell someone in Paro they are 0 km away.
      if (live && fix.source === "gps") {
        setKm(distanceKm(fix.coords, { lat: business.lat!, lng: business.lng! }));
      }
    });
    return () => {
      live = false;
    };
  }, [business]);

  const block = slot
    ? blockForSlot({
        existing: myBookings,
        businessId: business.id,
        start: slot.start,
        durationMin: service.durationMinutes,
      })
    : null;

  const travel = slot ? travelWarning({ km, start: slot.start, now: new Date() }) : null;

  const openExtras = () => setExtrasSession((n) => (n ?? 0) + 1);

  /** Step 1–3: guard, guest wall, then the extras sheet. */
  async function begin() {
    if (!slot) return;

    // 1. Say it before the RPC does, so the customer gets a sentence instead of a
    //    failed booking. The name comes from the *clashing* booking, which since
    //    THO-33 is usually a different salon than this one.
    if (block) {
      toast.error(bookingBlockMessage(block.reason, block.clash.businessName));
      return;
    }

    // 2. The wall at the last possible moment, with the salon, service and time
    //    choices still intact behind it.
    if (isGuest) {
      setWallOpen(true);
      return;
    }

    openExtras();
  }

  /** Steps 4–8. */
  async function confirm(extras: BookingExtras) {
    if (!slot) return;
    setExtrasSession(null);
    setBusy(true);

    const supabase = createClient();
    idempotencyKey.current ??= crypto.randomUUID();

    try {
      // 4. The booking itself. Everything after this point has already succeeded as
      //    far as the customer is concerned.
      const booking = await createBooking(supabase, {
        idempotencyKey: idempotencyKey.current,
        businessId: business.id,
        staffId: staff.id,
        serviceIds: [service.id],
        start: slot.start,
        customerNote: extras.note,
      });

      // 5. The style is a preference and `set_booking_hairstyle` re-checks the Pro
      //    gate itself, so a refusal here must not read as a failed booking.
      if (extras.hairstyleId) {
        try {
          await setBookingHairstyle(supabase, booking.id, extras.hairstyleId);
        } catch {
          // Booking succeeded; the style did not stick.
        }
      }

      // 6. Photos are uploaded **now**, not when they were picked — a dismissed
      //    sheet leaves nothing behind in the private bucket. Also best-effort.
      if (extras.photos.length > 0) {
        const paths: string[] = [];
        try {
          for (const photo of extras.photos) {
            paths.push(await uploadBookingPhoto(supabase, photo.blob, photo.mime));
          }
          await addBookingAttachments(supabase, booking.id, paths);
        } catch {
          // Don't leave the uploads orphaned if attaching them failed.
          await deleteBookingPhotos(supabase, paths);
          toast.error("Your booking is confirmed, but the photos didn't attach.");
        }
      }

      // 7. The sheet owns the reassurance and stays until dismissed.
      setConfirmed({ id: booking.id, start: slot.start });
      // The list behind this page is now stale.
      router.refresh();
    } catch (caught) {
      // A guest who got past the wall — the server is the authority, as designed.
      if (isGuestRefusal(caught)) {
        setWallOpen(true);
      } else {
        toast.error(
          bookingErrorMessage(caught, "Couldn't book that slot — it may have just been taken."),
        );
        // 8. Reload, so a slot someone else took stops being offered. A fresh key,
        //    because this attempt is over and the next one is a new booking.
        idempotencyKey.current = null;
        setSlot(null);
        setReloadKey((k) => k + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  const timeLabel = slot ? formatMinutesOfDay(thimphuMinutesOfDay(slot.start)) : "";

  return (
    <>
      <SlotPicker
        staffId={staff.id}
        serviceIds={[service.id]}
        selected={slot}
        onSelect={setSlot}
        disabled={busy}
        reloadKey={reloadKey}
      />

      {/* The sticky footer. A blocked slot **disables** the button rather than hiding
          it — a control that vanishes when you select something reads as a bug, and
          the reason has to sit next to the thing it is about. */}
      {slot ? (
        <div
          className={cn(
            "border-hairline bg-paper p-base fixed inset-x-0 bottom-0 z-20 border-t",
            // The inset is padding rather than an offset, so the bar's fill reaches the
            // bottom edge and only its content clears the iOS home indicator. It used to
            // offset by the tab bar's 62px as well; there is nothing under it now.
            "pb-[calc(var(--spacing-base)+env(safe-area-inset-bottom))]",
          )}
        >
          <div className="mx-auto max-w-[720px]">
            {block ? (
              <Notice kind="error">
                {bookingBlockMessage(block.reason, block.clash.businessName)}
              </Notice>
            ) : travel ? (
              // A warning, not a block: the customer may be about to set off, or may
              // know something a straight line doesn't.
              <Notice kind="warn">{travel}</Notice>
            ) : null}
            <Button
              fullWidth
              busy={busy}
              disabled={block != null}
              onClick={begin}
              className={block || travel ? "mt-sm" : undefined}
            >
              Book {timeLabel} · {formatNu(service.price)}
            </Button>
          </div>
        </div>
      ) : null}

      <GuestWall
        open={wallOpen}
        onClose={() => setWallOpen(false)}
        action="book"
        onUpgraded={async () => {
          // The guard needs the *new* user's history before we let them continue.
          try {
            setMyBookings(await myBookingsFor(createClient()));
          } catch {
            // The server still enforces it.
          }
          openExtras();
        }}
      />

      <BookingExtrasSheet
        key={extrasSession ?? "closed"}
        open={extrasSession != null}
        onClose={() => setExtrasSession(null)}
        onConfirm={confirm}
        service={service}
        staff={staff}
        timeLabel={timeLabel}
        // Pro-gated, and gated again server-side.
        offerStyles={hasFeature(business.plan, "stylePicker")}
      />

      {confirmed ? (
        <BookingConfirmedSheet
          open
          bookingId={confirmed.id}
          business={business}
          service={service}
          staff={staff}
          start={confirmed.start}
          onDone={() => {
            setConfirmed(null);
            router.push("/bookings");
          }}
        />
      ) : null}
    </>
  );
}

function Notice({
  kind,
  children,
}: {
  kind: "error" | "warn";
  children: React.ReactNode;
}) {
  const Icon = kind === "error" ? Icons.error : Icons.nearMe;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "text-body-sm text-ink p-md gap-sm flex items-start rounded-sm",
        kind === "error" ? "bg-error-soft" : "bg-star/10",
      )}
    >
      <Icon
        className={cn("mt-0.5 shrink-0", kind === "error" ? "text-error-text" : "text-star")}
        style={{ width: IconSize.xs, height: IconSize.xs }}
        aria-hidden
      />
      {children}
    </p>
  );
}
