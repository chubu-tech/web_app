"use client";

import { useEffect, useState } from "react";

/**
 * A tick that advances on an interval while the tab is visible.
 *
 * Extracted from `use-queue-line.ts`, which had the same three rules and now uses this:
 *
 * 1. **A hidden tab does not poll.** Checked inside the interval rather than held in
 *    state, so there is no `setState` in an effect body for the React compiler to object
 *    to — and browsers throttle timers in background tabs anyway, so skipping the
 *    *request* is the part that matters.
 * 2. **Returning to the tab bumps immediately**, rather than waiting out the interval.
 *    `setState` from a `visibilitychange` listener is a handler, not an effect body.
 * 3. **`paused` stops it dead.** Callers set it when there is nothing left to watch, and
 *    a tab regaining focus must not resurrect the timer.
 *
 * Fetching is the caller's job: key an effect on the returned tick. Keeping the data out
 * of here is what lets one hook serve a queue line, a message thread and a badge count,
 * which want different shapes for "nothing yet" and "the last read failed".
 */
export function usePollTick(intervalMs: number, paused = false): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setTick((n) => n + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, paused]);

  useEffect(() => {
    if (paused) return;
    const bump = () => {
      if (document.visibilityState !== "hidden") setTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", bump);
    return () => document.removeEventListener("visibilitychange", bump);
  }, [paused]);

  return tick;
}
