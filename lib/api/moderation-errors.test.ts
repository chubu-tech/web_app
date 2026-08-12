import { describe, expect, it } from "vitest";
import {
  acceptTermsErrorMessage,
  blockErrorMessage,
  MODERATION_ERROR,
  reportErrorMessage,
} from "./moderation-errors";

/** A PostgrestException as the client surfaces it: a code plus the server's raw message. */
const pg = (code: string, message = "") => ({ code, message });

describe("reportErrorMessage", () => {
  it("tells a guest what to do rather than reporting a server fault", () => {
    expect(reportErrorMessage(pg(MODERATION_ERROR.guestRefused))).toBe(
      "Create an account to report content.",
    );
  });

  it("treats an already-removed target as news, not a failure", () => {
    expect(reportErrorMessage(pg(MODERATION_ERROR.missing))).toBe("That's already been removed.");
  });

  it("falls back for anything unrecognised, including a non-Postgrest throw", () => {
    // `22023` is deliberately unmapped — this UI prevents both cases that raise it, so it
    // reads as a bug rather than as something the person can act on.
    expect(reportErrorMessage(pg(MODERATION_ERROR.invalid))).toBe(
      "Couldn't send that report. Please try again.",
    );
    expect(reportErrorMessage(new Error("network"))).toBe(
      "Couldn't send that report. Please try again.",
    );
    expect(reportErrorMessage(null)).toBe("Couldn't send that report. Please try again.");
  });
});

describe("blockErrorMessage", () => {
  it("states the RPC's own refusal even though a thread cannot reach it", () => {
    expect(blockErrorMessage(pg(MODERATION_ERROR.guestRefused), "Norzin")).toBe(
      "Create an account to block someone.",
    );
  });

  it("names the person only in the fallback", () => {
    expect(blockErrorMessage(pg(MODERATION_ERROR.missing), "Norzin")).toBe(
      "That account no longer exists.",
    );
    expect(blockErrorMessage(new Error("network"), "Norzin")).toBe(
      "Couldn't block Norzin. Check your connection and try again.",
    );
  });
});

describe("acceptTermsErrorMessage", () => {
  it("says what to do when a guest slipped past the wall", () => {
    expect(acceptTermsErrorMessage(pg(MODERATION_ERROR.guestRefused))).toBe(
      "Create an account first, then you can post.",
    );
  });

  it("falls back for anything else", () => {
    expect(acceptTermsErrorMessage(pg("XX000", "boom"))).toBe(
      "Couldn't save that. Please try again.",
    );
  });
});

describe("the three tables are kept apart on purpose", () => {
  /**
   * The guard for this module's reason to exist. `P0002` and `42501` are shared SQLSTATEs
   * with per-surface meanings, so a future merge into one table would have to pick one
   * sentence and be wrong on the other surface — the rule `queue-errors.ts` records.
   */
  it("gives P0002 a different sentence per surface", () => {
    expect(reportErrorMessage(pg(MODERATION_ERROR.missing))).not.toBe(
      blockErrorMessage(pg(MODERATION_ERROR.missing), "Norzin"),
    );
  });

  it("gives 42501 a different sentence per surface", () => {
    const code = pg(MODERATION_ERROR.guestRefused);
    const sentences = new Set([
      reportErrorMessage(code),
      blockErrorMessage(code, "Norzin"),
      acceptTermsErrorMessage(code),
    ]);
    expect(sentences.size).toBe(3);
  });
});
