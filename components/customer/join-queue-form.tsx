"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { GuestWall } from "@/components/auth/guest-wall";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { QueueWaitBadge } from "@/components/ui/queue-wait-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { SelectTile } from "@/components/ui/select-tile";
import { fetchActiveEntryForBusiness, joinQueue } from "@/lib/api/queue";
import { isAlreadyInLine, joinQueueErrorMessage, needsScan } from "@/lib/api/queue-errors";
import { queueLockState, queuePreview, queueShopSummary } from "@/lib/queue-logic";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/lib/types/queue";
import type { Business, ServiceItem, StaffMember } from "@/lib/types/salon";
import { formatDuration, formatNu } from "@/lib/utils";
import { useQueueLine } from "./use-queue-line";

/**
 * Taking a place in the walk-in line, ported from
 * `tho/app/lib/customer/queue/join_queue_sheet.dart`.
 *
 * **One component, two containers**: the body of `/q/[businessId]` (the QR target)
 * and the contents of a `Sheet` on the salon page — the same arrangement
 * `SlotPicker` has for booking and rescheduling, and for the same reason.
 *
 * It shows the wait **before** the customer commits: the shop's live badge plus a
 * projected "You'd be #4 · ~45 min" that moves as they change barber or service.
 * Both come from `queuePreview`/`queueShopSummary`, which are the very functions the
 * position view runs a moment later — so this cannot promise a figure the next screen
 * contradicts.
 *
 * `viaQr` must be true **only** for a genuine arrival through the shop's QR (i.e.
 * `/q/<id>`). A `qr_only` salon refuses anything else server-side with P0004, so
 * claiming a scan optimistically would trade a signposted "scan at the counter" for a
 * confusing failure.
 */
export function JoinQueueForm({
  business,
  services,
  staff,
  viaQr,
  initialLine = null,
  /** Closes the sheet when this is rendered inside one. */
  onDone,
}: {
  business: Business;
  services: ServiceItem[];
  staff: StaffMember[];
  viaQr: boolean;
  initialLine?: QueueEntry[] | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const lock = queueLockState(business, viaQr);

  const [staffId, setStaffId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallOpen, setWallOpen] = useState(false);

  /** Bumped per opening of the wall so its form starts empty — as in the guest wall's other callers. */
  const [wallSession, setWallSession] = useState(0);
  /** Set when the wall was opened by pressing Join, so an upgrade resumes the join. */
  const resumeAfterWall = useRef(false);

  // Locked shops never poll: `queue_active_line` would refuse a basic shop anyway,
  // and there is nothing on screen for the numbers to feed.
  const { line, loaded } = useQueueLine({
    businessId: business.id,
    intervalMs: 10_000,
    initial: initialLine,
    paused: lock !== "open",
  });

  const barberCount = staff.length > 0 ? staff.length : 1;
  const service = services.find((s) => s.id === serviceId) ?? null;

  if (lock !== "open") return <LockedBody state={lock} salonId={business.id} />;

  // Two live Growth salons list no services at all, so the app's required-service
  // rule would leave a form that can never be submitted. Say so instead.
  if (services.length === 0) {
    return (
      <EmptyState
        icon={Icons.haircut}
        title="Nothing to join for yet"
        message="This shop runs a walk-in queue but hasn't listed its services. Call them to ask about walking in."
        action={
          <Link
            href={`/salon/${business.id}`}
            className="text-body-sm text-rausch-cta font-medium underline"
          >
            View salon
          </Link>
        }
      />
    );
  }

  const summary = line ? queueShopSummary({ line, barberCount }) : null;
  const projection = line
    ? queuePreview({
        staffId,
        serviceMinutes: service?.durationMinutes ?? 0,
        line,
        barberCount,
      })
    : null;

  async function join() {
    if (!serviceId) {
      setError("Choose a service.");
      return;
    }
    const supabase = createClient();

    // Taking a place commits the customer to turning up, and the shop needs to know
    // who is in the line — `join_queue` refuses anonymous callers with P0010, so the
    // wall stands in front of a certain failure rather than after one.
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user || user.is_anonymous) {
      resumeAfterWall.current = true;
      setWallSession((n) => n + 1);
      setWallOpen(true);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const entry = await joinQueue(supabase, {
        businessId: business.id,
        staffId,
        serviceId,
        viaQr,
      });
      onDone?.();
      router.push(`/queue/${entry.id}`);
    } catch (caught) {
      // Already in this shop's line: what they want is their position, not an
      // error. The app's older full screen showed a message here and it was wrong.
      if (isAlreadyInLine(caught)) {
        const mine = await fetchActiveEntryForBusiness(
          supabase,
          user.id,
          business.id,
        ).catch(() => null);
        if (mine) {
          onDone?.();
          router.push(`/queue/${mine.id}`);
          return;
        }
      }
      setBusy(false);
      setError(joinQueueErrorMessage(caught));
      // A `qr_only` change server-side since this form rendered — reload so the
      // lock state catches up rather than leaving a button that cannot work.
      if (needsScan(caught)) router.refresh();
    }
  }

  return (
    <div className="p-base gap-lg flex flex-col">
      <div className="gap-md flex items-start justify-between">
        <div className="min-w-0">
          <h2 className="text-display-sm text-ink font-semibold">{business.name}</h2>
          <Link
            href={`/salon/${business.id}`}
            className="text-body-sm text-rausch-cta font-medium underline"
          >
            View salon
          </Link>
        </div>
      </div>

      <QueueWaitBadge
        waiting={summary?.waiting ?? null}
        etaMinutes={summary?.etaMinutes ?? null}
        className="self-start"
      />

      <section>
        <SectionHeader title="Barber" as="h3" />
        <ul className="gap-sm flex flex-col">
          {/* "Anyone" leads, and is the default: it is both the fastest option and
              the one whose ETA divides the shop's work across the barbers working it. */}
          <li>
            <SelectTile
              name="queue-staff"
              value=""
              checked={staffId === null}
              onSelect={() => setStaffId(null)}
              title="Anyone"
              subtitle="Whoever is free first"
            />
          </li>
          {staff.map((s) => (
            <li key={s.id}>
              <SelectTile
                name="queue-staff"
                value={s.id}
                checked={staffId === s.id}
                onSelect={setStaffId}
                title={s.displayName}
                subtitle={s.role}
                media={<Avatar name={s.displayName} photoUrl={s.photoUrl} size={40} />}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeader title="Service" as="h3" />
        {/* Deliberately **not** narrowed by `service_staff`, unlike the booking
            picker: `join_queue` only checks that both belong to the salon, and a
            walk-in line is not a scheduled appointment. Narrowing here would hide
            choices the server accepts. */}
        <ul className="gap-sm flex flex-col">
          {services.map((s) => (
            <li key={s.id}>
              <SelectTile
                name="queue-service"
                value={s.id}
                checked={serviceId === s.id}
                onSelect={(id) => {
                  setServiceId(id);
                  setError(null);
                }}
                title={s.name}
                subtitle={`${formatDuration(s.durationMinutes)} · ${formatNu(s.price)}`}
                media={
                  s.imageUrl ? (
                    <Avatar name={s.name} photoUrl={s.imageUrl} size={40} square />
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      </section>

      {/* The number they are actually deciding on, as the loudest thing above the
          button. It used to be a line of body text under two dropdowns, which made
          the decision read as a footnote. */}
      {projection ? (
        <div className="bg-surface-soft p-base rounded-md">
          <p aria-live="polite" className="text-title text-ink font-medium">
            {projection.etaMinutes === 0
              ? "You'd walk straight in"
              : `You'd be #${projection.position} in line`}
          </p>
          <p className="text-body-sm text-muted mt-xxs">
            {projection.etaMinutes === 0
              ? "No one ahead of you right now."
              : `About ${projection.etaMinutes} min to wait`}
          </p>
          <p className="text-caption-sm text-muted mt-sm gap-xs flex items-start">
            <Icons.timer
              className="mt-0.5 shrink-0"
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            {/* Not "we'll notify you" — see `QueuePositionCard`. Nothing delivers a
                queue notification today, on any platform. */}
            Once you join, your place updates on its own while the page is open.
          </p>
        </div>
      ) : loaded ? (
        <p className="text-body-sm text-muted">
          The live wait isn&apos;t available right now — you can still take a place in
          line.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-body-sm text-error-text">
          {error}
        </p>
      ) : null}

      <Button fullWidth busy={busy} onClick={join}>
        Join queue
      </Button>

      <GuestWall
        key={wallSession}
        open={wallOpen}
        onClose={() => setWallOpen(false)}
        action="queue"
        next={`/q/${business.id}`}
        onUpgraded={() => {
          setWallOpen(false);
          if (resumeAfterWall.current) {
            resumeAfterWall.current = false;
            void join();
          }
        }}
      />
    </div>
  );
}

/**
 * Two locked states, and they must not read alike.
 *
 * "Scan to join" is an **instruction** the customer can act on by walking to the
 * counter; "unavailable" is a fact about the shop. Flattening them into one message
 * turns a solvable situation into a dead end.
 */
function LockedBody({
  state,
  salonId,
}: {
  state: "needs_scan" | "unavailable";
  salonId: string;
}) {
  const viewSalon = (
    <Link
      href={`/salon/${salonId}`}
      className="text-body-sm text-rausch-cta font-medium underline"
    >
      View salon
    </Link>
  );

  if (state === "needs_scan") {
    return (
      <EmptyState
        icon={Icons.qr}
        title="Scan to join"
        message="This shop takes walk-ins on the spot. Scan the QR at the counter and you'll go straight into the line."
        action={viewSalon}
      />
    );
  }
  return (
    <EmptyState
      icon={Icons.locked}
      title="Walk-in queue unavailable"
      message="This shop hasn't turned on the walk-in queue. You can still book a time."
      action={viewSalon}
    />
  );
}
