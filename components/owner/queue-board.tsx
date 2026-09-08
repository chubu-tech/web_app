"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { callNext, setQueueStatus } from "@/lib/api/owner";
import { setQueueDeferral } from "@/lib/api/queue";
import { queueDeferralErrorMessage } from "@/lib/api/queue-errors";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import {
  barberFor,
  etaForPositionIn,
  queueBoardSummary,
  waitedLabel,
  type QueueBoardSummary,
} from "@/lib/queue-board";
import { canOwnerQueueTransition, orderedFor } from "@/lib/queue-logic";
import { createClient } from "@/lib/supabase/client";
import {
  deferredMinutesLeft,
  isDeferred,
  QUEUE_STEP_OUT_MINUTES,
  queueDisplayName,
  type QueueEntry,
  type QueueStatus,
} from "@/lib/types/queue";
import type { Business, ServiceItem, StaffMember } from "@/lib/types/salon";
import { cn } from "@/lib/utils";
import { AddWalkInSheet } from "./add-walk-in-sheet";
import { QueueQrSheet } from "./queue-qr-sheet";
import { useBusinessQueue } from "./use-business-queue";

/**
 * The live walk-in board — a port of `tho/app/lib/business/queue/queue_board.dart`,
 * and the thing that finally lets a web surface move a real line.
 *
 * It is laid out in the order an owner asks the questions, which is the Dart's own framing:
 *
 *   1. **How bad is it?** one line of figures
 *   2. **Who is in a chair?** Now serving, with Done / No-show
 *   3. **Who is next?** one shop-wide list, each row naming its barber
 *   4. **Who can take them?** a Call next per free barber
 *
 * It used to be a card per barber plus an "Anyone" card, so with three barbers and two
 * guests an owner read five cards, each with its own count, and none of them answered how
 * long the wait was.
 *
 * **Every action is optimistic and rolls back.** The board is on a four-second poll, so
 * waiting for a round trip before moving a row would make a busy counter feel broken; and
 * `call_next` claims the same front-of-line row that `orderedFor` picks here, which is the
 * only reason guessing is safe. A failure puts the row back exactly as it was and says why.
 *
 * **In-flight actions stay visible and go disabled — never hidden.** A button that vanishes
 * under a thumb is worse than one that says "Working…".
 */
export function QueueBoard({
  business,
  staff,
  services,
  initialEntries,
  /** `${origin}/q/${business.id}` — see the QR sheet for why it is not the app's scheme. */
  queueLink,
  queueQrSvg,
  runsQueue,
  clientProfileIds = [],
}: {
  business: Business;
  staff: StaffMember[];
  services: ServiceItem[];
  initialEntries: QueueEntry[];
  queueLink: string;
  queueQrSvg: string | null;
  runsQueue: boolean;
  /**
   * Which customer profiles have a page at `/business/clients/[id]` — i.e. who is in this
   * salon's client book. Resolved on the server, because that route 404s on a profile the book
   * does not contain and `client_book` is built from bookings, not from the queue. See
   * `Identity`.
   */
  clientProfileIds?: string[];
}) {
  const { entries, setEntries, refresh } = useBusinessQueue({
    businessId: business.id,
    initial: initialEntries,
    // A locked or switched-off queue polls nothing at all. Defence in depth against a
    // board that quietly costs a request every four seconds for a feature nobody has.
    paused: !runsQueue,
  });

  // A set once per mount rather than an `includes` per row per poll: the board re-renders
  // every four seconds and the book can hold every customer the salon has ever had.
  const clients = useMemo(() => new Set(clientProfileIds), [clientProfileIds]);

  const [callingStaff, setCallingStaff] = useState<string | null>(null);
  const [actingEntry, setActingEntry] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const summary = queueBoardSummary(entries, staff);

  /**
   * Take the front of the line into a chair.
   *
   * The optimistic pick uses `orderedFor(staff.id, entries)` — the same
   * priority-then-FIFO ordering `private.queue_claim_front` uses server-side — so the row
   * that moves locally is the row the RPC will claim.
   */
  async function doCallNext(barber: StaffMember) {
    if (callingStaff) return;
    const front = orderedFor(barber.id, entries)[0];
    if (!front) return;

    const before = entries;
    setCallingStaff(barber.id);
    setEntries(
      entries.map((e) =>
        e.id === front.id
          ? { ...e, status: "serving", staffMemberId: e.staffMemberId ?? barber.id }
          : e,
      ),
    );

    try {
      await callNext(createClient(), business.id, barber.id);
      refresh();
    } catch (caught) {
      setEntries(before);
      toast.error(ownerErrorMessage("callNext", caught));
      // A lost race means the board is out of date, not that the action was wrong.
      refresh();
    } finally {
      setCallingStaff(null);
    }
  }

  /**
   * Hold this row's place for ten minutes, or give it back.
   *
   * **The counter's own version of the customer's step-out**, and the reason the owner
   * needs it is that most people who step out say so to the person behind the counter
   * rather than opening an app. Before this the only thing an owner could do with
   * "back in five" was `no_show`, which ends the entry — so the board's answer to a
   * customer nipping to the ATM was to strike them off.
   *
   * No optimistic flip: the hold reorders the whole line, not one row, so a local patch
   * would leave every position around it disagreeing until `router.refresh()` lands.
   */
  async function doDefer(entry: QueueEntry, minutes: number) {
    setActingEntry(entry.id);
    try {
      await setQueueDeferral(createClient(), entry.id, minutes);
      toast.success(
        minutes > 0
          ? `${queueDisplayName(entry)}'s place is held for ${minutes} min.`
          : `${queueDisplayName(entry)} is back in line.`,
      );
      refresh();
    } catch (caught) {
      toast.error(queueDeferralErrorMessage(caught, minutes > 0 ? "out" : "back"));
    } finally {
      setActingEntry(null);
    }
  }

  async function doSetStatus(entry: QueueEntry, target: QueueStatus) {
    if (actingEntry) return;
    // The client mirror of the server's rule. A stale frame cannot double-action a row
    // that someone at another till already settled.
    if (!canOwnerQueueTransition(entry.status, target)) return;

    const before = entries;
    setActingEntry(entry.id);
    setEntries(entries.map((e) => (e.id === entry.id ? { ...e, status: target } : e)));

    try {
      await setQueueStatus(createClient(), entry.id, target);
      refresh();
    } catch (caught) {
      setEntries(before);
      toast.error(
        ownerErrorMessage(target === "done" ? "queueDone" : "queueNoShow", caught),
      );
      refresh();
    } finally {
      setActingEntry(null);
    }
  }

  /*
    The heading lives here rather than on the page, in **both** branches, because this component
    owns the width container — a page-level `h1` outside it would not line up with the board.

    It was missing from both until a route sweep read the `h1` of all 61 routes across the three
    roles and found this the only one with none: the board opened on `SummaryStrip` and the locked
    state on
    an `EmptyState`, whose title is a `<p>`. Every other console route has a visible `h1`, so this
    was a hole in the heading outline rather than a deliberate exception, and a screen reader
    landing here had nothing naming the page.
  */
  const heading = (
    <h1 className="text-display-lg text-ink mb-xs font-medium">Walk-in queue</h1>
  );

  /* ------------------------------------------------------------ locked ---- */
  if (!runsQueue) {
    return (
      <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
        {heading}
        <QueueLocked />
      </div>
    );
  }

  /* ------------------------------------------------------------- board ---- */
  return (
    <div className="px-base py-lg gap-base mx-auto flex w-full max-w-[1128px] flex-col tablet:px-lg">
      {heading}
      <SummaryStrip summary={summary} />

      <div className="gap-sm flex">
        <Button variant="outlined" fullWidth onClick={() => setQrOpen(true)}>
          <Icons.qr style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Show QR
        </Button>
        <Button fullWidth onClick={() => setWalkInOpen(true)}>
          <Icons.add style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Add walk-in
        </Button>
      </div>

      {staff.length === 0 && entries.length === 0 ? (
        <EmptyState
          icon={Icons.people}
          title="No one in line"
          message="Walk-ins will show up here once customers join."
        />
      ) : (
        <>
          {summary.nowServing.length > 0 ? (
            <SectionCard title="Now serving" count={String(summary.nowServing.length)}>
              <ul className="gap-sm flex flex-col">
                {summary.nowServing.map((e) => (
                  <li key={e.id}>
                    <ServingRow
                      entry={e}
                      barber={barberFor(summary, e)}
                      busy={actingEntry === e.id}
                      clientIds={clients}
                      onDone={() => void doSetStatus(e, "done")}
                      onNoShow={() => void doSetStatus(e, "no_show")}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {/* No count here: the strip above already carries it, and the same figure twice
              on one screen invites the reader to check whether they disagree. */}
          <SectionCard title="Next up" count="">
            {summary.nextUp.length === 0 ? (
              <p className="text-body-sm text-muted">No one waiting.</p>
            ) : (
              <ul>
                {summary.nextUp.map((e, i) => (
                  <li key={e.id}>
                    <WaitingRow
                      entry={e}
                      position={i + 1}
                      eta={etaForPositionIn(summary, i)}
                      barber={barberFor(summary, e)}
                      onHold={() => doDefer(e, QUEUE_STEP_OUT_MINUTES)}
                      onBack={() => doDefer(e, 0)}
                      busy={actingEntry === e.id}
                      clientIds={clients}
                      onNoShow={() => void doSetStatus(e, "no_show")}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <CallNextSection
            summary={summary}
            calling={callingStaff}
            onCall={(barber) => void doCallNext(barber)}
          />
        </>
      )}

      <QueueQrSheet
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        salonName={business.name}
        link={queueLink}
        svg={queueQrSvg}
      />
      <AddWalkInSheet
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        businessId={business.id}
        staff={staff}
        services={services}
        onAdded={refresh}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * "How bad is it right now", as one line of figures — the card that did not exist before
 * the Dart was reworked, when the wait had to be inferred from a per-barber count.
 */
function SummaryStrip({ summary: s }: { summary: QueueBoardSummary }) {
  const headline = s.isQuiet
    ? "No one in line"
    : `${s.waiting} waiting${
        s.nowServing.length === 0 ? "" : ` · ${s.nowServing.length} in the chair`
      }`;
  const detail = s.isQuiet
    ? "Walk straight in — every barber is free."
    : `~${s.etaMinutes} min wait · ${s.freeBarbers.length} of ${s.totalBarbers} ${
        s.totalBarbers === 1 ? "barber" : "barbers"
      } free${s.steppedOut > 0 ? ` · ${s.steppedOut} stepped out` : ""}`;

  return (
    <div className="border-hairline-soft bg-canvas shadow-card p-base rounded-md border">
      <p className="text-display-sm text-ink font-medium" aria-live="polite">
        {headline}
      </p>
      <p className="text-body-sm text-muted mt-xxs">{detail}</p>
    </div>
  );
}

function QueueLocked() {
  /*
    **One reason lands here now: the owner switched the queue off.**

    There used to be two, and the copy had to tell them apart — the plan did not include the
    queue, or it did and the switch was off. Migration `20260902000003_queue_for_all_plans.sql`
    removed the plan half from `join_queue`, `check_in_booking` and `queue_active_line`, so
    `runsQueue` is the switch alone and the "Growth feature" branch that used to sit here was a
    paywall in front of something every plan already has.

    Worth knowing why an owner may find it off without having touched it: `queue_enabled`
    defaults to true, so the same migration turned it off for every salon already on Basic
    rather than publishing a live "join the queue · N ahead" surface at ten real salons whose
    owners had never opened this board.
  */
  return (
    <EmptyState
      icon={Icons.locked}
      title="The walk-in queue is switched off"
      message="This salon is set to appointments only. Turn it back on and the board starts here."
      action={
        <Link
          href="/business/settings/salon"
          className="border-hairline text-title text-ink hover:bg-surface-soft inline-flex min-h-12 items-center rounded-sm border px-4 font-medium"
        >
          Open salon settings
        </Link>
      }
    />
  );
}

function SectionCard({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-hairline-soft bg-canvas shadow-card p-base rounded-md border">
      <div className="mb-sm flex items-center">
        <h2 className="text-title text-ink flex-1 font-semibold">{title}</h2>
        {count ? (
          <span className="text-caption-sm text-muted tabular-nums">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ServingRow({
  entry,
  barber,
  busy,
  clientIds,
  onDone,
  onNoShow,
}: {
  entry: QueueEntry;
  barber: string;
  busy: boolean;
  clientIds: ReadonlySet<string>;
  onDone: () => void;
  onNoShow: () => void;
}) {
  return (
    <div className="bg-surface-soft p-sm rounded-sm">
      <div className="gap-sm flex items-center">
        <Icons.haircut
          className="text-rausch shrink-0"
          style={{ width: IconSize.xs, height: IconSize.xs }}
          aria-hidden
        />
        <Identity entry={entry} clientIds={clientIds} />
        <span className="text-caption-sm text-rausch shrink-0 font-medium">{barber}</span>
      </div>
      <div className="gap-sm mt-sm flex flex-wrap">
        <Button variant="outlined" disabled={busy} onClick={onNoShow}>
          {busy ? "Working…" : "No-show"}
        </Button>
        <Button disabled={busy} onClick={onDone}>
          {busy ? "Working…" : "Done"}
        </Button>
      </div>
    </div>
  );
}

function WaitingRow({
  entry,
  position,
  eta,
  barber,
  busy,
  clientIds,
  onNoShow,
  onHold,
  onBack,
}: {
  entry: QueueEntry;
  position: number;
  eta: number;
  barber: string;
  busy: boolean;
  clientIds: ReadonlySet<string>;
  onNoShow: () => void;
  onHold: () => void;
  onBack: () => void;
}) {
  const held = isDeferred(entry);
  const name = queueDisplayName(entry);
  /*
    Read at render rather than held in state. The board re-renders on its own 4s poll, so
    the figure is never more than one tick stale — and a `now` in state would need a second
    timer whose only job is to age a caption by a minute.
  */
  const waited = waitedLabel(entry.joinedAt, new Date());

  return (
    /* The row dims as one object while its occupant is out, and the **controls stay at full
       strength** — an owner has to be able to read the button they are reaching for. */
    <div className={cn("py-xs gap-sm flex items-center", held && "opacity-60")}>
      {/*
        The position pip stays drawn while held, in muted rather than being renumbered away.
        The hold puts them at the end of the ordering, so their number *has* moved — but a
        row that loses its pip reads as a row that has left, which is the one thing a hold
        is not.
      */}
      <span
        className={cn(
          "text-caption-sm flex size-6 shrink-0 items-center justify-center rounded-full font-medium tabular-nums",
          held ? "bg-surface-strong text-muted" : "bg-surface-soft text-ink",
        )}
      >
        #{position}
      </span>
      <Identity entry={entry} clientIds={clientIds} />
      <span
        className={cn(
          "text-badge px-sm shrink-0 rounded-full py-px font-medium",
          barber === "Anyone" ? "bg-surface-soft text-muted" : "bg-surface-strong text-ink",
        )}
      >
        {barber}
      </span>
      {held ? (
        /*
          The ETA is replaced rather than joined, because a held row has no meaningful one:
          the hold is what decides when they are next, not the work in front of them. The
          chip is the "I'm back" control, which is the action the counter actually performs
          — somebody walks back in and says so.

          `opacity-100` undoes the row's dimming for the same reason the × below does.
        */
        <button
          type="button"
          disabled={busy}
          onClick={onBack}
          aria-label={`Stepped out, back in ${deferredMinutesLeft(entry)} minutes. Activate to put ${name} back in line.`}
          className="bg-surface-strong text-badge text-ink border-star px-sm shrink-0 rounded-full border py-px font-medium opacity-100 tabular-nums disabled:opacity-50"
        >
          Back in {deferredMinutesLeft(entry)}m
        </button>
      ) : (
        <>
          {/*
            The wait, and under it how long they have already had of it.

            **The second line is the board's only fairness signal.** An ETA says when
            somebody will be seated; it says nothing about the guest who has been sitting
            there for half an hour while barber-specific requests were called past them. The
            ordering is fair by construction — what it cannot show is that *fair* and *long*
            are different problems, and only one of them is visible from behind the counter.

            'Up next' only when nothing is in progress. With a cut running, the front of the
            line still has that cut to wait out, and saying 'Up next' beside a 20-minute wait
            was the board's one outright lie.
          */}
          <span className="w-16 shrink-0 text-right">
            <span className="text-caption-sm text-muted block tabular-nums">
              {eta === 0 ? "Up next" : `~${eta} min`}
            </span>
            <span
              className={cn(
                "text-badge block tabular-nums",
                waited.long ? "text-star" : "text-muted-soft",
              )}
            >
              {waited.label}
            </span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={onHold}
            title={`Hold this place for ${QUEUE_STEP_OUT_MINUTES} minutes`}
            aria-label={`Hold ${name}'s place for ${QUEUE_STEP_OUT_MINUTES} minutes`}
            className="text-muted hover:text-ink flex size-8 shrink-0 items-center justify-center rounded-full opacity-100 disabled:opacity-50"
          >
            <Icons.timer style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          </button>
        </>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onNoShow}
        title="Mark no-show"
        aria-label={`Mark ${name} as a no-show`}
        className="text-muted hover:text-ink flex size-8 shrink-0 items-center justify-center rounded-full opacity-100 disabled:opacity-50"
      >
        <Icons.close style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Avatar, name and phone for one row — and a link to the client's record when there is one.
 *
 * **This used to be inert, and the reason expired.** 3a's note said the app opens the client
 * book from here but that surface did not exist yet; 3c built `/business/clients/[id]`.
 *
 * **It links only when the route will actually render**, which is three conditions, not one —
 * and the third is the one that is easy to miss:
 *
 * 1. The entry has a `customer_profile_id`. A walk-in typed in at the counter has none, so
 *    there is nobody to open; the app pushes a detail screen anyway and then hides both of its
 *    sections.
 * 2. The salon has the `clientBook` feature — `/business/clients/[id]` `notFound()`s otherwise.
 * 3. **They are in the client book.** `client_book` is built from `bookings`, so somebody who
 *    walked in off the street and has never booked is *not* in it, and that route 404s on a
 *    profile it cannot find. On this seed that is the common case, not the edge one: all 9
 *    live queue entries belong to Norzin and none has ever carried a `booking_id`.
 *
 * `clientIds` is resolved on the server and passed down for exactly that reason. An empty set
 * means every row stays plain text, which is what it did before and is never wrong.
 */
function Identity({
  entry,
  clientIds,
}: {
  entry: QueueEntry;
  clientIds: ReadonlySet<string>;
}) {
  const name = entry.customerName ?? "Walk-in";
  const href =
    entry.customerProfileId && clientIds.has(entry.customerProfileId)
      ? `/business/clients/${entry.customerProfileId}`
      : null;

  return (
    <span className="gap-sm flex min-w-0 flex-1 items-center">
      <Avatar name={name} photoUrl={entry.customerAvatarUrl} size={36} />
      <span className="min-w-0">
        {href ? (
          <Link
            href={href}
            className="text-body-md text-ink hover:text-rausch-cta block truncate underline decoration-transparent transition-colors duration-[var(--duration-fast)] hover:decoration-current"
          >
            {name}
          </Link>
        ) : (
          <span className="text-body-md text-ink block truncate">{name}</span>
        )}
        {entry.customerPhone ? (
          <span className="text-caption-sm text-muted block truncate tabular-nums">
            {entry.customerPhone}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * One button per **free** barber.
 *
 * A busy barber has no button at all: "Call next" while someone is still in their chair was
 * never a legal move, and a disabled button per barber was four-fifths noise.
 */
function CallNextSection({
  summary: s,
  calling,
  onCall,
}: {
  summary: QueueBoardSummary;
  calling: string | null;
  onCall: (barber: StaffMember) => void;
}) {
  if (s.freeBarbers.length === 0) {
    if (s.totalBarbers === 0) return null;
    return (
      <p className="text-body-sm text-muted">
        {s.waiting === 0
          ? "Every barber is with someone."
          : "Every barber is with someone — the line moves when one finishes."}
      </p>
    );
  }

  return (
    <div className="gap-sm flex flex-col">
      {s.freeBarbers.map((barber) => (
        <Button
          key={barber.id}
          fullWidth
          disabled={s.nextUp.length === 0 || calling != null}
          busy={calling === barber.id}
          onClick={() => onCall(barber)}
        >
          {calling === barber.id ? "Calling…" : `Call next · ${barber.displayName}`}
        </Button>
      ))}
    </div>
  );
}
