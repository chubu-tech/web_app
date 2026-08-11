"use client";

import { useCallback, useEffect, useState } from "react";
import { usePollTick } from "@/components/customer/use-poll";
import { fetchBusinessQueue } from "@/lib/api/owner";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/lib/types/queue";

/**
 * The salon's live line, kept fresh while the board is open.
 *
 * The owner's counterpart to `use-queue-line.ts`, on the app's **4-second** cadence
 * (`queue_board.dart`'s `Timer.periodic`), and polling rather than subscribing because the
 * `supabase_realtime` publication contains **zero tables** — a Postgres-Changes
 * subscription here would connect, succeed, and silently deliver nothing forever.
 *
 * Three rules, two of them the same as the customer hook's and one that is new:
 *
 * 1. **A hidden tab does not poll**, and returning to it refreshes at once. `usePollTick`
 *    owns that for every polling surface in the app.
 * 2. **Only the first read may show an error.** A failed poll keeps the last good board
 *    rather than blanking a line that has people standing in it — the app is explicit
 *    about this, and it matters more here than anywhere: a board that empties itself
 *    because of one dropped request is a board that loses somebody's turn.
 * 3. **`refresh()` is for after an action.** Call next, Done and No-show all change the
 *    line, and waiting up to four seconds to see it would make the board feel broken. It
 *    is called from an event handler, never an effect body, so it is a bump and not a
 *    render-time write.
 *
 * `entries` is never null: the board is server-rendered with its first read already done,
 * so there is no unknown-versus-empty problem of the kind `QueueWaitBadge` has to model.
 */
export function useBusinessQueue({
  businessId,
  initial,
  paused = false,
}: {
  businessId: string;
  initial: QueueEntry[];
  paused?: boolean;
}): {
  entries: QueueEntry[];
  /** Set only when the first client read failed and there is nothing good to show. */
  failed: boolean;
  /** Replace the board locally — the optimistic half of an action. */
  setEntries: (next: QueueEntry[]) => void;
  refresh: () => void;
} {
  const [entries, setEntries] = useState<QueueEntry[]>(initial);
  const [failed, setFailed] = useState(false);
  const [nudge, setNudge] = useState(0);
  const tick = usePollTick(4000, paused);

  useEffect(() => {
    if (paused) return;
    // Nothing to fetch on mount: the server already read the line for the first paint.
    if (tick === 0 && nudge === 0) return;

    let live = true;
    fetchBusinessQueue(createClient(), businessId)
      .then((next) => {
        if (!live) return;
        setEntries(next);
        setFailed(false);
      })
      .catch(() => {
        // Silent on a background poll — the last good board stays. Only a first read with
        // nothing behind it is worth telling the owner about.
        if (live) setFailed((prev) => prev);
      });
    return () => {
      live = false;
    };
  }, [businessId, tick, nudge, paused]);

  const refresh = useCallback(() => setNudge((n) => n + 1), []);

  return { entries, failed, setEntries, refresh };
}
