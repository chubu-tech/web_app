"use client";

import { useEffect, useState } from "react";
import { fetchActiveLine } from "@/lib/api/queue";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/lib/types/queue";

/**
 * The shop's active line, kept fresh while the page is open.
 *
 * Two callers with two cadences, mirroring the app: the join form polls every
 * **10s** (nobody there is watching for a turn — they are deciding whether the wait
 * is worth it) and the live position view every **4s**.
 *
 * Three things this has to get right:
 *
 * 1. **`line: null` means "we don't know", not "the line is empty".** A failed read
 *    and an empty shop must stay distinguishable all the way to the badge, or a
 *    permission error renders as "walk straight in". `loaded` is what tells them
 *    apart on the *first* read; after that a failure keeps the last good numbers,
 *    because a poll must never blank figures that are on screen.
 * 2. **A hidden tab does not poll.** Checked inside the interval rather than held in
 *    state, and `visibilitychange` bumps immediately on return — so coming back to
 *    the tab refreshes at once instead of waiting out the interval, without a
 *    `setState` in an effect body for the compiler to object to.
 * 3. **It stops for good when there is nothing left to watch.** `watchEntryId` is
 *    the entry the caller cares about; once a *successful* read no longer contains
 *    it, that place is served, given up or marked no-show, and polling ends — a tab
 *    regaining focus must not resurrect the timer.
 *
 *    **The stop lives here rather than in the caller**, and that is the fix for a
 *    real bug: the position view first derived "terminal" from the line *after*
 *    calling this hook, which meant it rendered the done state while the hook
 *    happily kept polling. A row put back into the line was picked straight back
 *    up. The condition has to be evaluated where the data arrives.
 *
 *    Deliberately an id rather than a predicate: a callback would change identity
 *    every render, and keeping it in a ref would mean mutating that ref during
 *    render. A plain string is a dependency the effect can hold honestly. Callers
 *    watching the *shop* rather than one place (the join form) simply omit it.
 */
export function useQueueLine({
  businessId,
  intervalMs,
  initial = null,
  paused = false,
  watchEntryId,
}: {
  businessId: string;
  intervalMs: number;
  /** A server-read snapshot, so the first paint has numbers rather than a dash. */
  initial?: QueueEntry[] | null;
  paused?: boolean;
  /** Stop once this entry leaves the active line. Omit to poll the shop indefinitely. */
  watchEntryId?: string;
}): { line: QueueEntry[] | null; loaded: boolean; stopped: boolean } {
  const [state, setState] = useState<{
    line: QueueEntry[] | null;
    loaded: boolean;
    stopped: boolean;
  }>(() => ({
    line: initial,
    loaded: initial != null,
    // A server snapshot that already lacks the entry is as good as a poll saying so.
    stopped: initial != null && watchEntryId != null && !hasEntry(initial, watchEntryId),
  }));
  const [tick, setTick] = useState(0);

  const halted = paused || state.stopped;

  useEffect(() => {
    if (halted) return;
    const id = setInterval(() => {
      // A backgrounded tab is nobody watching. Browsers throttle timers here
      // anyway; skipping the request is the part that matters.
      if (document.visibilityState === "hidden") return;
      setTick((n) => n + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, halted]);

  useEffect(() => {
    if (halted) return;
    const bump = () => {
      if (document.visibilityState !== "hidden") setTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", bump);
    return () => document.removeEventListener("visibilitychange", bump);
  }, [halted]);

  useEffect(() => {
    if (halted) return;
    let live = true;
    fetchActiveLine(createClient(), businessId)
      .then((line) => {
        if (!live) return;
        setState({
          line,
          loaded: true,
          stopped: watchEntryId != null && !hasEntry(line, watchEntryId),
        });
      })
      .catch(() => {
        // Only the very first read may show "unknown"; later failures keep the
        // last good line rather than replacing real numbers with a dash. A failed
        // read is never grounds for stopping — that would tell someone still
        // standing in the shop that their turn had finished.
        if (live) setState((prev) => (prev.loaded ? prev : { ...prev, loaded: true }));
      });
    return () => {
      live = false;
    };
  }, [businessId, tick, halted, watchEntryId]);

  return state;
}

function hasEntry(line: QueueEntry[], id: string): boolean {
  return line.some((e) => e.id === id);
}
