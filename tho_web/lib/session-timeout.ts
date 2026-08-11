/**
 * The idle clock for the owner console and the staff shell.
 *
 * ## Why the console only, and why the app has nothing like this
 *
 * `../tho` has **no idle timeout at all**. `AuthGate` watches `onAuthStateChange` and shows
 * the sign-in screen when the session goes null, and that is the whole of it — expiry is
 * whatever Supabase's refresh token decides. So this is a **deliberate web-only
 * divergence**, the eighth in this repo, and the reason is a threat model the phone does
 * not have: a salon's console is run from a machine behind the counter that staff share and
 * customers stand next to. `app/auth/sign-out/route.ts` already documents the same concern
 * from the other end — `tho_active_business` was surviving a year on exactly such a machine.
 *
 * **Customer routes deliberately get no idle clock.** A customer is on their own phone, and
 * signing somebody out because they spent half an hour choosing between two salons would
 * cost them a half-built booking to protect nothing. Their session still ends when Supabase
 * says it does; see `SESSION_ENDED_REASON` for how that is told to them rather than being
 * silent.
 *
 * ## Why the state is a pure function of two numbers
 *
 * Everything here takes `lastActivityMs` and `now` and returns what to do. No timers, no
 * DOM, no storage — those live in `IdleTimeout`, which is a client component. Pure logic
 * belongs in `lib/` in this repo for a reason that has already cost it once: a `"use client"`
 * module's non-component exports reach a server component as client *references*, so the
 * server throws at render while the build stays green. See the note on `customerName` in
 * AGENTS.md.
 */

/** How long without interaction before the console signs somebody out. */
export const IDLE_LIMIT_MS = 30 * 60_000;

/** How long before the cut the warning appears. */
export const IDLE_WARN_MS = 2 * 60_000;

/**
 * Where the last interaction is recorded, and it is `localStorage` on purpose.
 *
 * The console is routinely open in more than one tab — the calendar in one, a client's
 * record in another — and a per-tab timer would sign the owner out of the tab they were not
 * looking at while they worked in the one they were. Sharing the timestamp across tabs of
 * the same origin makes "idle" mean *the person* is idle, which is the thing being measured.
 */
export const IDLE_ACTIVITY_KEY = "tho_last_activity";

/**
 * How often an interaction is allowed to write to `localStorage`.
 *
 * Pointer and scroll events arrive in the hundreds per second and a synchronous
 * `localStorage` write on each one would be a measurable jank source of its own. At this
 * cadence the recorded time is at worst this far behind the truth, which against a
 * thirty-minute limit is noise.
 */
export const IDLE_WRITE_THROTTLE_MS = 15_000;

export type IdlePhase = "active" | "warning" | "expired";

export type IdleState = {
  phase: IdlePhase;
  /**
   * Milliseconds until the phase changes — what to set a single timer to, rather than
   * polling every second for thirty minutes.
   *
   * Zero when already expired.
   */
  msUntilNext: number;
  /** Whole seconds left before sign-out, for the warning's countdown. Never negative. */
  secondsLeft: number;
};

/**
 * What phase the clock is in, and how long until the next one.
 *
 * Deliberately total: a `lastActivityMs` in the future (a clock adjustment, or another tab
 * on a machine whose time moved) is treated as "just now" rather than producing a negative
 * countdown or an immediate sign-out. Time going backwards must not log anybody out.
 */
export function idleState({
  lastActivityMs,
  now,
  limitMs = IDLE_LIMIT_MS,
  warnMs = IDLE_WARN_MS,
}: {
  lastActivityMs: number;
  now: number;
  limitMs?: number;
  warnMs?: number;
}): IdleState {
  const elapsed = Math.max(0, now - lastActivityMs);
  const remaining = limitMs - elapsed;

  if (remaining <= 0) return { phase: "expired", msUntilNext: 0, secondsLeft: 0 };

  const secondsLeft = Math.ceil(remaining / 1000);

  if (remaining <= warnMs) {
    return { phase: "warning", msUntilNext: remaining, secondsLeft };
  }
  return { phase: "active", msUntilNext: remaining - warnMs, secondsLeft };
}

/**
 * Read the shared timestamp, falling back to `now`.
 *
 * A missing, unparseable or non-numeric value means "no record", and the safe reading of no
 * record is **that the person just arrived** — not that they have been idle for ever. The
 * opposite default would sign somebody out on their first paint in a fresh browser, or any
 * time storage is unavailable (private mode, a blocked origin), which is a lockout dressed
 * as a security feature.
 */
export function readLastActivity(raw: string | null, now: number): number {
  if (raw == null) return now;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : now;
}

/**
 * The query parameter `/sign-in` reads to explain why somebody is looking at it.
 *
 * Two values, because the two cases are not the same sentence: `idle` is *we* ended it and
 * they can simply sign back in, `expired` is the session running out on its own. Anything
 * else renders no message at all rather than a guess — the same rule `safeNext` follows for
 * a parameter that arrives from outside.
 */
export const SESSION_ENDED_REASON = "reason";

export type SessionEndedReason = "idle" | "expired";

const REASON_COPY: Record<SessionEndedReason, string> = {
  idle: "You were signed out after 30 minutes without activity. Sign in to carry on.",
  expired: "Your session ended. Sign in to carry on where you left off.",
};

/** The sentence for a `?reason=`, or null for anything not recognised. */
export function sessionEndedMessage(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "idle" || value === "expired") return REASON_COPY[value];
  return null;
}

/**
 * The breadcrumb `proxy.ts` leaves when a real session turns out to be dead.
 *
 * Not `httpOnly` and not a secret: it carries no identity, only the fact that the token this
 * browser arrived with is no longer accepted — which its own user is about to be told.
 */
export const SESSION_ENDED_COOKIE = "tho_session_ended";

/**
 * Where to send somebody who needs an account, and whether to explain why.
 *
 * The distinction this exists for: `/business` refuses a signed-out caller either way, but
 * *"sign in to continue"* is right for a first visit and wrong for somebody who was working
 * a minute ago. Only `proxy.ts` can tell those apart — see the note there on why the
 * evidence is gone by render time — so it leaves the breadcrumb and this reads it.
 */
export function sessionEndedRedirect(next: string, sessionEnded: boolean): string {
  const params = new URLSearchParams({ next });
  if (sessionEnded) params.set(SESSION_ENDED_REASON, "expired");
  return `/sign-in?${params.toString()}`;
}
