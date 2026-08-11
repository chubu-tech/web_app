"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { callNext, setQueueStatus } from "@/lib/api/owner";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import {
  barberFor,
  etaForPositionIn,
  queueBoardSummary,
  type QueueBoardSummary,
} from "@/lib/queue-board";
import { canOwnerQueueTransition, orderedFor } from "@/lib/queue-logic";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry, QueueStatus } from "@/lib/types/queue";
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
        <QueueLocked business={business} />
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
      } free`;

  return (
    <div className="border-hairline-soft bg-canvas shadow-card p-base rounded-md border">
      <p className="text-display-sm text-ink font-medium" aria-live="polite">
        {headline}
      </p>
      <p className="text-body-sm text-muted mt-xxs">{detail}</p>
    </div>
  );
}

function QueueLocked({ business }: { business: Business }) {
  // Two different reasons land here, and the copy has to tell them apart: the plan does not
  // include the queue, or it does and the owner switched it off in the app's Settings. The
  // app conflates them — its board gates on the plan alone, so a Growth salon with the
  // queue off still gets a live board with a working Call next while `join_queue` refuses
  // its customers. `runsQueue` is the predicate that covers both, and this is the fourth
  // documented divergence from the Dart.
  const entitled = business.plan === "growth" || business.plan === "pro";
  return entitled ? (
    <EmptyState
      icon={Icons.locked}
      title="The walk-in queue is switched off"
      // 3a had to say "in the app's Settings", because the web had none. 3b does, so this
      // points at it — a message telling someone to go and find another client for a switch
      // that is two clicks away is worse than no message.
      message="Your plan includes it, but this salon is set to appointments only. Turn it back on and the board starts here."
      action={
        <Link
          href="/business/settings/salon"
          className="border-hairline text-title text-ink hover:bg-surface-soft inline-flex min-h-12 items-center rounded-sm border px-4 font-medium"
        >
          Open salon settings
        </Link>
      }
    />
  ) : (
    <EmptyState
      icon={Icons.locked}
      title="Walk-in queue is a Growth feature"
      message="A live walk-in line for your salon is part of the Growth plan."
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
}: {
  entry: QueueEntry;
  position: number;
  eta: number;
  barber: string;
  busy: boolean;
  clientIds: ReadonlySet<string>;
  onNoShow: () => void;
}) {
  return (
    <div className="py-xs gap-sm flex items-center">
      <span className="bg-surface-soft text-caption-sm text-ink flex size-6 shrink-0 items-center justify-center rounded-full font-medium tabular-nums">
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
      {/* 'Up next' only when nothing is in progress. With a cut running, the front of the
          line still has that cut to wait out, and saying 'Up next' beside a 20-minute wait
          was the board's one outright lie. */}
      <span className="text-caption-sm text-muted w-16 shrink-0 text-right tabular-nums">
        {eta === 0 ? "Up next" : `~${eta} min`}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onNoShow}
        title="Mark no-show"
        aria-label={`Mark ${entry.customerName ?? "walk-in"} as a no-show`}
        className="text-muted hover:text-ink flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
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
