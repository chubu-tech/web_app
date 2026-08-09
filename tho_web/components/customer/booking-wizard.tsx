"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GuestWall } from "@/components/auth/guest-wall";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import {
  addBookingAttachments,
  createBooking,
  deleteBookingPhotos,
  fetchMyBookings,
  setBookingHairstyle,
  uploadBookingPhoto,
} from "@/lib/api/booking";
import { bookingErrorMessage, isGuestRefusal } from "@/lib/api/booking-errors";
import {
  basketDuration,
  basketTotal,
  bookableServices,
  eligibleStaff,
} from "@/lib/booking-basket";
import {
  blockForSlot,
  bookingBlockMessage,
  distanceKm,
  travelWarning,
} from "@/lib/booking-guards";
import { hasFeature } from "@/lib/entitlements";
import { resolveLocation } from "@/lib/geo";
import { releasePreview } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { addDays, fromIsoDay, toIsoDay } from "@/lib/time";
import type { Booking } from "@/lib/types/booking";
import { hasLocation, type Business, type ServiceItem, type StaffMember } from "@/lib/types/salon";
import { cn, formatNu } from "@/lib/utils";
import { BookingConfirmedSheet } from "./booking-confirmed-sheet";
import {
  BookingConfirmStep,
  EMPTY_EXTRAS,
  type BookingExtras,
} from "./booking-confirm-step";
import { ANY_STAFF, BookingProfessionalStep } from "./booking-professional-step";
import { BookingServiceStep } from "./booking-service-step";
import { BookingSummary } from "./booking-summary";
import { BookingTimeStep, DAYS_AHEAD } from "./booking-time-step";
import { useAvailability, type SlotOption } from "./use-availability";

/**
 * The booking flow — four steps, one running order, and the customer's half of
 * multi-service booking.
 *
 * ## What this replaced, and why the shape changed
 *
 * Before this, choosing *what* and *who* happened on `/salon/[id]`, `/salon/[id]/book`
 * was a slot grid entered with both already decided, and everything else — the note, the
 * photos, the style — appeared in a modal sheet at the end. Four consequences, all of
 * which this fixes:
 *
 * - **One service per appointment.** `create_booking` has taken `p_service_ids` as an
 *   array since it was written and the owner's counter form has sent several since 3a;
 *   the customer side was the gap `AGENTS.md` calls "the real gap, and the next slice".
 * - **The price was in the button and nowhere else.** There was no itemisation until
 *   after the booking existed.
 * - **Changing your mind meant leaving.** Service and stylist lived on a different route,
 *   so re-deciding either one cost the slot you had chosen.
 * - **The last step was a modal**, which needs its own focus trap and its own dismissal
 *   to be reachable at all, and which had 512px to hold a photo row.
 *
 * ## The URL is the state, and history is the Back button
 *
 * `?step=&service=&staff=&date=&slot=` — repeatable `service`, so the basket is in the
 * address bar. That makes the flow reloadable and shareable, and it is what makes the
 * browser's own Back move between steps rather than out of the flow. Same call
 * `/business`'s calendar makes with `?d=&view=&seg=`.
 *
 * **Written with `history.pushState`, not `router.push`.** A `router.push` to the same
 * route re-runs the server component, which is four Supabase reads per step — for a
 * change that alters nothing the server rendered. Next supports the native History API
 * for exactly this and keeps `useSearchParams` in step with it.
 *
 * A step change **pushes**; a selection change inside a step **replaces**. So Back is a
 * step, not the last chip you tapped.
 *
 * ## Nothing is trusted from the URL
 *
 * Every parameter is re-derived against the salon's real data on each render:
 * unknown service ids are dropped, a stylist who does not perform the whole basket is
 * dropped, a day outside the 60-day window is clamped, and `step` is clamped to the
 * furthest one the selections actually reach. A hand-edited `?step=confirm` with nothing
 * chosen lands on Services, not on a Book button that would raise.
 */

const STEPS = ["services", "professional", "time", "confirm"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABEL: Record<Step, string> = {
  services: "Services",
  professional: "Professional",
  time: "Time",
  confirm: "Confirm",
};

const STEP_TITLE: Record<Step, string> = {
  services: "Select services",
  professional: "Select professional",
  time: "Select date and time",
  confirm: "Review and confirm",
};

export function BookingWizard({
  business,
  services: allServices,
  staff: allStaff,
  staffByService,
  isGuest,
  /** Thimphu's today, resolved on the server so the strip and the guard agree. */
  today: todayIso,
}: {
  business: Business;
  services: ServiceItem[];
  staff: StaffMember[];
  staffByService: Record<string, string[]>;
  /** True with no session or an anonymous one — either way, the wall applies. */
  isGuest: boolean;
  today: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const today = useMemo(() => fromIsoDay(todayIso), [todayIso]);

  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [km, setKm] = useState<number | null>(null);
  const [wallOpen, setWallOpen] = useState(false);
  const [extras, setExtras] = useState<BookingExtras>(EMPTY_EXTRAS);
  const [confirmed, setConfirmed] = useState<{ id: string; start: Date; staff: StaffMember } | null>(
    null,
  );

  /**
   * One key per confirm attempt, held across retries.
   *
   * `create_booking` catches its own unique violation and returns the booking the key
   * already made, so reusing it turns a double-click or a retry into the *same* booking.
   * Minting a fresh key per press is exactly what would produce two.
   */
  const idempotencyKey = useRef<string | null>(null);

  // --- what the URL says, narrowed to what the salon can actually do ----------------

  const bookable = useMemo(
    () => bookableServices(allServices, staffByService),
    [allServices, staffByService],
  );

  const basket = useMemo(() => {
    const wanted = params.getAll("service");
    // Mapped through `bookable` rather than filtered in place: that drops ids this salon
    // does not have *and* ids nobody performs, dedupes, and fixes the order to the URL's.
    const seen = new Set<string>();
    const out: ServiceItem[] = [];
    for (const id of wanted) {
      if (seen.has(id)) continue;
      const match = bookable.find((s) => s.id === id);
      if (match) {
        seen.add(id);
        out.push(match);
      }
    }
    return out;
  }, [params, bookable]);

  const basketIds = useMemo(() => basket.map((s) => s.id), [basket]);

  const eligible = useMemo(
    () => eligibleStaff(basketIds, staffByService, allStaff),
    [basketIds, staffByService, allStaff],
  );

  const staffParam = params.get("staff");
  const staffId =
    staffParam === ANY_STAFF
      ? eligible.length > 0
        ? ANY_STAFF
        : null
      : eligible.some((s) => s.id === staffParam)
        ? staffParam
        : null;

  /** The named stylist, or null while "any" is chosen. The summary says which. */
  const chosenStaff = staffId && staffId !== ANY_STAFF
    ? (eligible.find((s) => s.id === staffId) ?? null)
    : null;

  const day = useMemo(() => {
    const iso = params.get("date");
    if (!iso) return today;
    const parsed = fromIsoDay(iso);
    if (Number.isNaN(parsed.getTime())) return today;
    // Clamped into the window the strip offers, so a stale link from last month cannot
    // select a day that is not on it.
    const last = addDays(today, DAYS_AHEAD - 1);
    if (parsed < today) return today;
    if (parsed > last) return last;
    return parsed;
  }, [params, today]);

  const askStaffIds = useMemo(
    () => (staffId === ANY_STAFF ? eligible.map((s) => s.id) : staffId ? [staffId] : []),
    [staffId, eligible],
  );

  const { slots, loading, error } = useAvailability({
    staffIds: askStaffIds,
    serviceIds: basketIds,
    day,
    reloadKey,
  });

  const slotParam = params.get("slot");
  const selectedSlot = useMemo<SlotOption | null>(() => {
    if (!slotParam) return null;
    const wanted = new Date(slotParam).getTime();
    if (Number.isNaN(wanted)) return null;
    return slots.find((s) => s.start.getTime() === wanted) ?? null;
  }, [slotParam, slots]);

  // The selected start survives a reload before the slots have arrived, so the summary
  // can state the appointment while the grid is still loading. `selectedSlot` is the one
  // that has to exist to book, because only it knows who is free.
  const selectedStart = useMemo(() => {
    if (!slotParam) return null;
    const parsed = new Date(slotParam);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [slotParam]);

  /** The furthest step the current selections earn. */
  const reachable: Step =
    selectedStart != null && staffId
      ? "confirm"
      : staffId
        ? "time"
        : basket.length > 0
          ? "professional"
          : "services";

  const wanted = (params.get("step") ?? "services") as Step;
  const step: Step = STEPS.includes(wanted)
    ? STEPS.indexOf(wanted) <= STEPS.indexOf(reachable)
      ? wanted
      : reachable
    : "services";

  // --- writing the URL --------------------------------------------------------------

  /**
   * The base is `window.location.search`, **not** the `params` from `useSearchParams`.
   *
   * That is not a preference. `history.replaceState` updates the address bar
   * synchronously but `useSearchParams` only catches up on the next render, so two
   * presses inside one turn — tick two services quickly, or any programmatic pair — both
   * read the *pre-first-press* value and the second silently discards the first.
   * Measured: ticking two services put one of them in the URL and priced the basket at
   * one. Reading the location makes each write build on the one before it.
   */
  const write = useCallback(
    (mutate: (next: URLSearchParams) => void, mode: "push" | "replace") => {
      const next = new URLSearchParams(window.location.search);
      mutate(next);
      const url = `${window.location.pathname}?${next.toString()}`;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [],
  );

  const goTo = useCallback(
    (target: Step) => {
      write((next) => next.set("step", target), "push");
      // A step change is a new screen; the previous one may have been scrolled.
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    [write],
  );

  function toggleService(id: string) {
    write((next) => {
      const current = next.getAll("service");
      next.delete("service");
      const after = current.includes(id)
        ? current.filter((s) => s !== id)
        : [...current, id];
      for (const s of after) next.append("service", s);

      // Removing the last service, or adding one this stylist cannot do, invalidates
      // everything downstream. Cleared here, in the handler, rather than in an effect —
      // it is a consequence of the press, not of the render.
      const stillOk =
        next.get("staff") === ANY_STAFF ||
        after.every((serviceId) => staffByService[serviceId]?.includes(next.get("staff") ?? ""));
      if (after.length === 0 || !stillOk) {
        next.delete("staff");
        next.delete("slot");
      }
    }, "replace");
  }

  function pickStaff(id: string) {
    // A different stylist has a different diary, so the slot cannot survive the change.
    write((next) => {
      next.set("staff", id);
      next.delete("slot");
    }, "replace");
  }

  function pickDay(nextDay: Date) {
    write((next) => {
      next.set("date", toIsoDay(nextDay));
      next.delete("slot");
    }, "replace");
  }

  function pickSlot(slot: SlotOption) {
    write((next) => next.set("slot", slot.start.toISOString()), "replace");
  }

  // --- guards -----------------------------------------------------------------------

  useEffect(() => {
    let live = true;
    // Best-effort: the server enforces the same rules, so a failure here just means it
    // does the rejecting instead of us warning first.
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const list = await fetchMyBookings(supabase, user.id);
      if (live) setMyBookings(list);
    })().catch(() => {});
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

  /** Release any object URLs the flow still holds when it goes away for good. */
  useEffect(() => {
    const held = extras.photos;
    return () => {
      held.forEach(releasePreview);
    };
    // Deliberately keyed on nothing: this is unmount cleanup for whatever is held at
    // that moment, and re-running it per photo change would revoke a live thumbnail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duration = basketDuration(basket);

  const block =
    selectedStart != null
      ? blockForSlot({
          existing: myBookings,
          businessId: business.id,
          start: selectedStart,
          durationMin: duration,
        })
      : null;

  const travel = selectedStart
    ? travelWarning({ km, start: selectedStart, now: new Date() })
    : null;

  /**
   * Who the booking is actually filed against.
   *
   * With a named stylist it is that person. With "any professional" it is the first
   * eligible stylist **who is free at the chosen time** — which is why `SlotOption`
   * carries `staffIds` at all. `eligible` order is the salon's own roster order, so the
   * choice is stable rather than dependent on which fan-out call returned first.
   */
  const resolvedStaff: StaffMember | null =
    chosenStaff ??
    (selectedSlot
      ? (eligible.find((s) => selectedSlot.staffIds.includes(s.id)) ?? null)
      : null);

  // --- confirming -------------------------------------------------------------------

  async function begin() {
    if (!selectedStart || basket.length === 0) return;

    // Say it before the RPC does, so the customer gets a sentence instead of a failed
    // booking. The name comes from the *clashing* booking, which since THO-33 is usually
    // a different salon than this one.
    if (block) {
      toast.error(bookingBlockMessage(block.reason, block.clash.businessName));
      return;
    }

    // The wall at the last possible moment, with every choice still intact behind it.
    if (isGuest) {
      setWallOpen(true);
      return;
    }

    await confirm();
  }

  async function confirm() {
    if (!selectedStart || basket.length === 0) return;

    if (!resolvedStaff) {
      // Only reachable when "any professional" was chosen and the slot has since gone,
      // which a reload onto a stale `?slot=` can produce. Send them back rather than
      // guess a stylist the server would refuse.
      toast.error("That time has just gone — pick another.");
      setReloadKey((k) => k + 1);
      write((next) => next.delete("slot"), "replace");
      goTo("time");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    idempotencyKey.current ??= crypto.randomUUID();

    try {
      const booking = await createBooking(supabase, {
        idempotencyKey: idempotencyKey.current,
        businessId: business.id,
        staffId: resolvedStaff.id,
        serviceIds: basketIds,
        start: selectedStart,
        customerNote: extras.note.trim() ? extras.note.trim() : null,
      });

      // The style is a preference and `set_booking_hairstyle` re-checks the Pro gate
      // itself, so a refusal here must not read as a failed booking.
      if (extras.hairstyleId) {
        try {
          await setBookingHairstyle(supabase, booking.id, extras.hairstyleId);
        } catch {
          // Booking succeeded; the style did not stick.
        }
      }

      // Photos are uploaded **now**, not when they were picked — an abandoned flow
      // leaves nothing behind in the private bucket. Also best-effort.
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

      setConfirmed({ id: booking.id, start: selectedStart, staff: resolvedStaff });
      // The list behind this flow is now stale.
      router.refresh();
    } catch (caught) {
      // A guest who got past the wall — the server is the authority, as designed.
      if (isGuestRefusal(caught)) {
        setWallOpen(true);
      } else {
        toast.error(
          bookingErrorMessage(caught, "Couldn't book that slot — it may have just been taken."),
        );
        // Reload, so a slot someone else took stops being offered. A fresh key, because
        // this attempt is over and the next one is a new booking.
        idempotencyKey.current = null;
        write((next) => next.delete("slot"), "replace");
        setReloadKey((k) => k + 1);
        goTo("time");
      }
    } finally {
      setBusy(false);
    }
  }

  // --- the action, which is different on every step ---------------------------------

  const index = STEPS.indexOf(step);

  const action = (() => {
    if (step === "services") {
      return (
        <Button
          fullWidth
          disabled={basket.length === 0}
          onClick={() => goTo("professional")}
        >
          Continue
        </Button>
      );
    }
    if (step === "professional") {
      return (
        <Button fullWidth disabled={!staffId} onClick={() => goTo("time")}>
          Continue
        </Button>
      );
    }
    if (step === "time") {
      return (
        <Button fullWidth disabled={!selectedStart} onClick={() => goTo("confirm")}>
          Continue
        </Button>
      );
    }
    return (
      <Button fullWidth busy={busy} disabled={block != null} onClick={begin}>
        Book · {formatNu(basketTotal(basket))}
      </Button>
    );
  })();

  const note =
    step === "confirm" && block ? (
      <Notice kind="error">
        {bookingBlockMessage(block.reason, block.clash.businessName)}
      </Notice>
    ) : step === "confirm" && travel ? (
      // A warning, not a block: the customer may be about to set off, or may know
      // something a straight line doesn't.
      <Notice kind="warn">{travel}</Notice>
    ) : undefined;

  return (
    <>
      {/*
        The chrome. Back and Close are both here and they are **not** the same control:
        Back is one step, Close leaves the flow. Fresha draws both, and on a website the
        distinction matters more — the site header is still above this, so Close is the
        one that says "I am done with this", not the only way out.
      */}
      <div className="gap-base mb-lg flex items-start">
        <button
          type="button"
          onClick={() =>
            index === 0 ? router.push(`/salon/${business.id}`) : goTo(STEPS[index - 1]!)
          }
          aria-label={index === 0 ? `Back to ${business.name}` : `Back to ${STEP_LABEL[STEPS[index - 1]!]}`}
          className="border-hairline bg-paper text-ink hover:border-border-strong grid size-11 shrink-0 place-items-center rounded-full border"
        >
          <Icons.back style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <Breadcrumb step={step} reachable={reachable} onGo={goTo} />
          <h1 className="text-display-xl text-ink mt-xs font-semibold">{STEP_TITLE[step]}</h1>
        </div>

        <Link
          href={`/salon/${business.id}`}
          aria-label="Close and go back to the salon"
          className="border-hairline bg-paper text-ink hover:border-border-strong grid size-11 shrink-0 place-items-center rounded-full border"
        >
          <Icons.close style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
        </Link>
      </div>

      <div className="gap-xl desktop:grid-cols-[minmax(0,1fr)_400px] grid">
        <div>
          {step === "services" ? (
            <BookingServiceStep
              services={bookable}
              unbookableCount={allServices.length - bookable.length}
              selectedIds={basketIds}
              onToggle={toggleService}
            />
          ) : step === "professional" ? (
            <BookingProfessionalStep
              staff={eligible}
              selectedId={staffId}
              onSelect={pickStaff}
              blockedServiceNames={eligible.length === 0 ? basket.map((s) => s.name) : []}
            />
          ) : step === "time" ? (
            <BookingTimeStep
              today={today}
              day={day}
              onPickDay={pickDay}
              slots={slots}
              loading={loading}
              error={error}
              selectedStart={selectedStart}
              onPickSlot={pickSlot}
              onRetry={() => setReloadKey((k) => k + 1)}
              staffLabel={chosenStaff ? chosenStaff.displayName : "Any professional"}
              onChangeStaff={() => goTo("professional")}
            />
          ) : (
            <BookingConfirmStep
              services={basket}
              extras={extras}
              onChange={setExtras}
              // Pro-gated, and gated again server-side.
              offerStyles={hasFeature(business.plan, "stylePicker")}
            />
          )}
        </div>

        <BookingSummary
          business={business}
          services={basket}
          staff={resolvedStaff ?? chosenStaff}
          start={selectedStart}
          action={action}
          note={note}
        />
      </div>

      <GuestWall
        open={wallOpen}
        onClose={() => setWallOpen(false)}
        action="book"
        onUpgraded={async () => {
          // The guard needs the *new* user's history before we let them continue.
          try {
            const supabase = createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) setMyBookings(await fetchMyBookings(supabase, user.id));
          } catch {
            // The server still enforces it.
          }
          await confirm();
        }}
      />

      {confirmed ? (
        <BookingConfirmedSheet
          open
          bookingId={confirmed.id}
          business={business}
          services={basket}
          staff={confirmed.staff}
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

/**
 * `Services › Professional › Time › Confirm`.
 *
 * A completed step is a button back to itself; a step not yet earned is plain text, not
 * a disabled button — there is nothing to press and nothing to explain, and a row of
 * greyed controls reads as broken rather than as sequential.
 */
function Breadcrumb({
  step,
  reachable,
  onGo,
}: {
  step: Step;
  reachable: Step;
  onGo: (step: Step) => void;
}) {
  return (
    <nav aria-label="Booking steps">
      <ol className="gap-xs flex flex-wrap items-center">
        {STEPS.map((s, i) => {
          const current = s === step;
          const open = STEPS.indexOf(s) <= STEPS.indexOf(reachable);
          return (
            <li key={s} className="gap-xs flex items-center">
              {i > 0 ? (
                <Icons.chevronRight
                  className="text-muted-soft"
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
              ) : null}
              {open && !current ? (
                <button
                  type="button"
                  onClick={() => onGo(s)}
                  className="text-caption text-ink hover:text-rausch-cta font-medium"
                >
                  {STEP_LABEL[s]}
                </button>
              ) : (
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "text-caption font-medium",
                    current ? "text-ink" : "text-muted-soft",
                  )}
                >
                  {STEP_LABEL[s]}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
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
