"use client";

import { useEffect, useRef, useState } from "react";
import {
  IDLE_ACTIVITY_KEY,
  IDLE_LIMIT_MS,
  IDLE_WARN_MS,
  IDLE_WRITE_THROTTLE_MS,
  idleState,
  readLastActivity,
  type IdlePhase,
} from "@/lib/session-timeout";

/**
 * Signs a console session out after 30 minutes without interaction, warning first.
 *
 * Mounted by `app/business/layout.tsx` and `app/staff/layout.tsx` and by nothing else — see
 * `lib/session-timeout.ts` for why the customer surface deliberately has no idle clock, and
 * why `../tho` has none anywhere.
 *
 * ## One timer, not a tick
 *
 * The naïve version runs a one-second interval for half an hour and compares timestamps.
 * This arms a **single** `setTimeout` for exactly as long as `idleState` says the current
 * phase can last — 28 minutes, then one per remaining second but only while the warning is
 * on screen. An idle console therefore costs two timer firings in thirty minutes rather than
 * eighteen hundred, which matters on a till machine already running a 4-second queue poll.
 *
 * ## Activity is shared between tabs
 *
 * The console is routinely open twice — the calendar in one tab, a client's record in
 * another. A per-tab timer would sign the owner out of whichever tab they were not looking
 * at, which is both wrong and baffling. The last interaction goes to `localStorage`, so
 * "idle" measures the person rather than the document, and a `storage` event lets a tab
 * showing the warning cancel it the moment its sibling sees a keypress.
 *
 * ## Everything lives in one effect, and that is two lint rules rather than a preference
 *
 * The first version had `schedule` in a `useCallback` that re-armed by passing itself to
 * `setTimeout`. Two problems, both caught by the gate rather than by review:
 *
 * - **`react-hooks/immutability`** rejects a `useCallback` that references itself.
 * - **`react-hooks/set-state-in-effect`** — the rule this repo already hit once, on
 *   `usePrefersReducedMotion` — rejects a state setter called *synchronously* from an
 *   effect body, which is what arming on mount did.
 *
 * So `arm` is a plain closure inside the effect, and it takes `applyState`. On mount it is
 * called with `false`: the effect has just written `now()` to storage, so the phase is
 * necessarily `active`, which is already the initial state — there is nothing to set. Every
 * later call comes from a timer callback or a DOM event, where a setter is perfectly legal.
 *
 * ## The sign-out is the real one
 *
 * It submits the existing `app/auth/sign-out` form POST rather than calling
 * `supabase.auth.signOut()` in the browser. That route is the only thing that can clear
 * `tho_active_business` — it is `httpOnly`, so client JavaScript architecturally cannot — and
 * leaving a previous user's salon id behind on a shared machine is precisely the residue
 * this feature exists to remove. A client-side sign-out would look identical and leave it.
 */
export function IdleTimeout({
  /** Overridable so a manual check need not wait half an hour. */
  limitMs = IDLE_LIMIT_MS,
  warnMs = IDLE_WARN_MS,
}: {
  limitMs?: number;
  warnMs?: number;
}) {
  const [phase, setPhase] = useState<IdlePhase>("active");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const formRef = useRef<HTMLFormElement | null>(null);
  /** Lets the banner's two buttons reach into the effect's closure. */
  const bumpRef = useRef<(force?: boolean) => void>(() => {});
  const signOutRef = useRef<() => void>(() => {});

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastWrite = 0;
    /** Guards against submitting twice when a timer and a storage event race. */
    let submitted = false;

    const readActivity = () => {
      try {
        return readLastActivity(window.localStorage.getItem(IDLE_ACTIVITY_KEY), Date.now());
      } catch {
        // Private mode, or an origin with storage blocked. `readLastActivity`'s own fallback
        // is "just arrived", and so is this: a storage failure must never be the reason
        // somebody is signed out.
        return Date.now();
      }
    };

    const write = () => {
      try {
        window.localStorage.setItem(IDLE_ACTIVITY_KEY, String(Date.now()));
      } catch {
        // Handled by readActivity's fallback; nothing to do.
      }
    };

    const doSignOut = () => {
      if (submitted) return;
      submitted = true;
      formRef.current?.requestSubmit();
    };

    /**
     * Re-evaluate and arm exactly one timer for the next transition.
     *
     * `applyState` is false only for the call on mount — see the note above on
     * `set-state-in-effect`.
     */
    const arm = (applyState: boolean) => {
      if (timer != null) clearTimeout(timer);

      const state = idleState({ lastActivityMs: readActivity(), now: Date.now(), limitMs, warnMs });
      if (applyState) {
        setPhase(state.phase);
        setSecondsLeft(state.secondsLeft);
      }

      if (state.phase === "expired") {
        doSignOut();
        return;
      }

      // During the warning, wake every second to move the countdown; otherwise sleep right
      // through to the moment the warning is due.
      const wait =
        state.phase === "warning" ? Math.min(1000, state.msUntilNext) : state.msUntilNext;
      timer = setTimeout(() => arm(true), Math.max(250, wait));
    };

    /** Record an interaction, throttled, and re-arm. */
    const bump = (force = false) => {
      const t = Date.now();
      if (!force && t - lastWrite < IDLE_WRITE_THROTTLE_MS) return;
      lastWrite = t;
      write();
      arm(true);
    };

    bumpRef.current = bump;
    signOutRef.current = doSignOut;

    // Arriving on a console route is itself an interaction. Written unthrottled, so a
    // navigation inside the throttle window cannot leave another tab's older timestamp
    // standing — and armed without touching state, because the phase is `active` by
    // construction at this point.
    write();
    arm(false);

    const onActivity = () => bump();
    // `passive` on the two high-frequency ones so the listener cannot delay a scroll.
    const passive = { passive: true } as const;
    window.addEventListener("pointerdown", onActivity, passive);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, passive);
    window.addEventListener("focus", onActivity);

    // Returning to a tab is not activity in itself — the clock deliberately kept running
    // while it was hidden — but it is the moment to re-read what other tabs recorded, and to
    // act if the limit passed while this tab slept. Browsers throttle timers in background
    // tabs, so a late firing cannot be relied on.
    const onVisible = () => {
      if (document.visibilityState === "visible") arm(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    // Another tab saw an interaction. Either way this tab's countdown is stale.
    const onStorage = (e: StorageEvent) => {
      if (e.key === IDLE_ACTIVITY_KEY) arm(true);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("focus", onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
      if (timer != null) clearTimeout(timer);
    };
  }, [limitMs, warnMs]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <>
      {/*
        The real sign-out, kept in the tree so the timer has something to submit. `reason` is
        what lets `/sign-in` explain itself rather than presenting a bare form to somebody
        who pressed nothing.
      */}
      <form ref={formRef} action="/auth/sign-out" method="post" className="hidden">
        <input type="hidden" name="reason" value="idle" />
      </form>

      {phase === "warning" ? (
        /*
          A banner rather than a `Sheet`, deliberately. Every other modal in this app is built
          on `Sheet` and should be — but `Sheet` traps focus, and pulling focus out of a
          half-typed walk-in form to announce a timeout risks losing the very work the owner
          is being interrupted about. `role="alert"` gets it announced without moving the
          caret.
        */
        <div
          role="alert"
          aria-live="assertive"
          className="px-base pb-base fixed inset-x-0 bottom-0 z-50 flex justify-center"
        >
          <div className="border-hairline bg-surface shadow-card gap-base px-lg py-md tablet:flex-row tablet:items-center flex w-full max-w-[560px] flex-col items-start rounded-xl border">
            <div className="min-w-0 flex-1">
              <p className="text-title text-ink font-semibold">Still there?</p>
              <p className="text-body-sm text-body mt-xs">
                You&rsquo;ll be signed out in{" "}
                <span className="font-medium tabular-nums">
                  {minutes}:{String(seconds).padStart(2, "0")}
                </span>{" "}
                to keep this salon&rsquo;s data safe on a shared computer.
              </p>
            </div>
            <div className="gap-sm flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => bumpRef.current(true)}
                className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed px-lg inline-flex min-h-11 items-center rounded-full font-medium"
              >
                Stay signed in
              </button>
              <button
                type="button"
                onClick={() => signOutRef.current()}
                className="text-title text-muted hover:text-ink px-md inline-flex min-h-11 items-center rounded-full font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
