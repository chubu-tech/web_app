"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { QueuePositionCard } from "@/components/ui/queue-position-card";
import { Skeleton } from "@/components/ui/skeleton";
import { leaveQueue } from "@/lib/api/queue";
import { leaveQueueErrorMessage } from "@/lib/api/queue-errors";
import { canCustomerLeave, etaMinutesFor, isTerminal, positionOf } from "@/lib/queue-logic";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/lib/types/queue";
import { useQueueLine } from "./use-queue-line";

/**
 * The live "your place in line" view, ported from
 * `tho/app/lib/customer/queue/your_turn_screen.dart`.
 *
 * Position and ETA are recomputed from the pure helpers over **each fresh line**,
 * never from a locally mutated copy, so the screen always reflects the server's
 * ordering rather than a guess that drifts.
 *
 * It reads `queue_active_line` rather than the table for a specific reason: a
 * customer's RLS-scoped read of `queue_entries` returns only their own row, which made
 * position and ETA compute as "#1 · 0 min" against a one-element list.
 *
 * **Once the entry leaves the shop's active list it is terminal** — served, left, or
 * marked no-show — and polling stops for good. There is nothing left to watch, and a
 * tab regaining focus must not restart it.
 */
export function QueuePosition({
  entry,
  initialLine,
  staffNames,
  barberCount,
}: {
  /** The row as read on the server, for the first paint and the salon's name. */
  entry: QueueEntry;
  initialLine: QueueEntry[] | null;
  /** Staff id → display name, so the card can say "with <name>". */
  staffNames: Record<string, string>;
  barberCount: number;
}) {
  const [left, setLeft] = useState(false);
  const [busy, setBusy] = useState(false);

  // Terminal from the server read is terminal already — don't poll a finished place.
  const startedTerminal = isTerminal(entry.status);
  /**
   * `watchEntryId` is what ends the poll: the hook stops once a **successful** read no
   * longer contains this entry. Deciding that here instead, from the line the hook
   * returns, is what let an earlier version render the done state while still polling —
   * so the rule lives where the data lands.
   *
   * A *failed* read never counts as gone. Treating it as terminal would tell a customer
   * still standing in the shop that their turn had finished.
   */
  const { line, loaded, stopped } = useQueueLine({
    businessId: entry.businessId,
    intervalMs: 4_000,
    initial: initialLine,
    paused: startedTerminal || left,
    watchEntryId: entry.id,
  });

  const mine = line?.find((e) => e.id === entry.id) ?? null;
  const terminal = startedTerminal || left || stopped;

  async function leave() {
    setBusy(true);
    try {
      await leaveQueue(createClient(), entry.id);
      setLeft(true);
    } catch {
      toast.error(leaveQueueErrorMessage());
    } finally {
      setBusy(false);
    }
  }

  if (terminal) {
    return (
      <EmptyState
        icon={Icons.success}
        title={left ? "You've left the queue" : "You're all done"}
        message={
          left
            ? "Your place has been given up. You can join again any time."
            : "Your turn has finished, or your place was given up."
        }
        action={
          <Link href={`/salon/${entry.businessId}`}>
            <Button variant="outlined">Back to the salon</Button>
          </Link>
        }
      />
    );
  }

  // No line yet and none supplied by the server — the very first read is in flight.
  if (!loaded) {
    return (
      <div className="gap-md flex flex-col">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-12 rounded-sm" />
      </div>
    );
  }

  if (line == null) {
    return (
      <EmptyState
        icon={Icons.offline}
        title="Couldn't load your place in line"
        message="You're still in the queue — this page just can't reach the shop's list right now. It keeps trying."
      />
    );
  }

  // Present in the line, or the server's own row until the next poll lands.
  const current = mine ?? entry;

  return (
    <div className="gap-lg flex flex-col">
      <QueuePositionCard
        serving={current.status === "serving"}
        position={positionOf(current, line)}
        etaMinutes={etaMinutesFor(current, line, { barberCount })}
        // The polled rows are PII-free and carry no salon name, so it comes from
        // the server-read entry instead.
        businessName={entry.businessName}
        staffName={
          current.staffMemberId == null
            ? "Anyone"
            : (staffNames[current.staffMemberId] ?? null)
        }
      />

      {canCustomerLeave(current.status) ? (
        <Button variant="outlined" fullWidth busy={busy} onClick={leave}>
          Leave queue
        </Button>
      ) : null}
    </div>
  );
}
