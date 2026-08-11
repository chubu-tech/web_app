import { describe, expect, it } from "vitest";
import {
  IDLE_LIMIT_MS,
  IDLE_WARN_MS,
  idleState,
  readLastActivity,
  sessionEndedMessage,
} from "./session-timeout";

const T0 = 1_000_000_000_000;

describe("idleState", () => {
  it("is active immediately after an interaction", () => {
    const s = idleState({ lastActivityMs: T0, now: T0 });
    expect(s.phase).toBe("active");
    expect(s.secondsLeft).toBe(IDLE_LIMIT_MS / 1000);
  });

  it("schedules the next wake for when the warning is due, not every second", () => {
    // The whole point of returning `msUntilNext`: one timer for 28 minutes, rather than a
    // 1s interval ticking 1,800 times to discover the same thing.
    const s = idleState({ lastActivityMs: T0, now: T0 });
    expect(s.msUntilNext).toBe(IDLE_LIMIT_MS - IDLE_WARN_MS);
  });

  it("enters the warning exactly on the boundary, not one tick late", () => {
    const atBoundary = T0 + (IDLE_LIMIT_MS - IDLE_WARN_MS);
    expect(idleState({ lastActivityMs: T0, now: atBoundary }).phase).toBe("warning");
    // One millisecond earlier is still active — pins which side of the boundary is which.
    expect(idleState({ lastActivityMs: T0, now: atBoundary - 1 }).phase).toBe("active");
  });

  it("counts down through the warning", () => {
    const s = idleState({ lastActivityMs: T0, now: T0 + IDLE_LIMIT_MS - 30_000 });
    expect(s.phase).toBe("warning");
    expect(s.secondsLeft).toBe(30);
    expect(s.msUntilNext).toBe(30_000);
  });

  it("expires on the limit and stays expired after it", () => {
    expect(idleState({ lastActivityMs: T0, now: T0 + IDLE_LIMIT_MS }).phase).toBe("expired");
    expect(idleState({ lastActivityMs: T0, now: T0 + IDLE_LIMIT_MS * 9 }).phase).toBe("expired");
  });

  it("never reports a negative countdown", () => {
    const s = idleState({ lastActivityMs: T0, now: T0 + IDLE_LIMIT_MS * 3 });
    expect(s.secondsLeft).toBe(0);
    expect(s.msUntilNext).toBe(0);
  });

  it("treats a future timestamp as 'just now' rather than expiring", () => {
    // A clock adjustment, or a second tab on a machine whose time moved. Time going
    // backwards must not sign anybody out — this is the case that would, if `elapsed`
    // were allowed to be negative and the comparison flipped.
    const s = idleState({ lastActivityMs: T0 + 60_000, now: T0 });
    expect(s.phase).toBe("active");
    expect(s.secondsLeft).toBe(IDLE_LIMIT_MS / 1000);
  });

  it("honours overridden windows, so the test suite need not wait 30 minutes", () => {
    const s = idleState({ lastActivityMs: T0, now: T0 + 400, limitMs: 1000, warnMs: 500 });
    expect(s.phase).toBe("active");
    expect(idleState({ lastActivityMs: T0, now: T0 + 600, limitMs: 1000, warnMs: 500 }).phase).toBe(
      "warning",
    );
  });
});

describe("readLastActivity", () => {
  it("treats no record as 'just arrived', never as 'idle for ever'", () => {
    // The load-bearing default. The opposite would sign somebody out on their first paint
    // in a fresh browser, or wherever localStorage is unavailable — a lockout wearing a
    // security feature's clothes.
    expect(readLastActivity(null, T0)).toBe(T0);
  });

  it("rejects junk and zero rather than trusting them as a timestamp", () => {
    expect(readLastActivity("banana", T0)).toBe(T0);
    expect(readLastActivity("", T0)).toBe(T0);
    expect(readLastActivity("0", T0)).toBe(T0);
    expect(readLastActivity("NaN", T0)).toBe(T0);
    expect(readLastActivity("Infinity", T0)).toBe(T0);
  });

  it("uses a real recorded time", () => {
    expect(readLastActivity(String(T0 - 5_000), T0)).toBe(T0 - 5_000);
  });
});

describe("sessionEndedMessage", () => {
  it("names the two cases differently, because they are not the same sentence", () => {
    const idle = sessionEndedMessage("idle");
    const expired = sessionEndedMessage("expired");
    expect(idle).toMatch(/30 minutes/);
    expect(expired).toMatch(/session ended/i);
    expect(idle).not.toBe(expired);
  });

  it("renders nothing for an unrecognised value rather than guessing", () => {
    expect(sessionEndedMessage("hacked")).toBeNull();
    expect(sessionEndedMessage(undefined)).toBeNull();
    expect(sessionEndedMessage("")).toBeNull();
  });

  it("takes the first value when the parameter is repeated", () => {
    expect(sessionEndedMessage(["idle", "expired"])).toBe(sessionEndedMessage("idle"));
  });
});
