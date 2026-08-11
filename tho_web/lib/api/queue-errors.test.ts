import { describe, expect, it } from "vitest";
import {
  checkInErrorMessage,
  isAlreadyInLine,
  joinQueueErrorMessage,
  needsScan,
  QUEUE_ERROR,
} from "./queue-errors";

/** A PostgrestException as the client surfaces it: a code plus the server's raw message. */
const pg = (code: string, message = "") => ({ code, message });

describe("joinQueueErrorMessage", () => {
  it("tells a guest what to do rather than reporting a server fault", () => {
    expect(joinQueueErrorMessage(pg(QUEUE_ERROR.guestRefused, "create an account to join the queue")))
      .toBe("Create an account to join the queue.");
  });

  it("turns a qr_only refusal into an instruction, not a failure", () => {
    expect(joinQueueErrorMessage(pg("P0004", "scan the shop QR to join this queue"))).toBe(
      "Scan the shop's QR at the counter to join this queue.",
    );
  });

  it("names the plan gate", () => {
    expect(joinQueueErrorMessage(pg("P0001", "this shop is not running a queue"))).toBe(
      "This shop isn't running a queue.",
    );
  });

  it("falls back for anything unrecognised", () => {
    expect(joinQueueErrorMessage(pg("XX000", "boom"))).toBe(
      "Couldn't join the queue. Please try again.",
    );
    expect(joinQueueErrorMessage(new Error("network"))).toBe(
      "Couldn't join the queue. Please try again.",
    );
  });
});

describe("checkInErrorMessage", () => {
  /**
   * The reason this file exists. P0004 is two unrelated facts sharing one code,
   * and each RPC's map has to give its own answer — a single shared table would
   * have to pick one and be wrong half the time.
   */
  it("passes P0004 through, because the server's message is the actionable part", () => {
    expect(checkInErrorMessage(pg("P0004", "check-in opens 2 hours before your appointment"))).toBe(
      "Check-in opens 2 hours before your appointment.",
    );
    expect(checkInErrorMessage(pg("P0004", "this appointment is too old to check in"))).toBe(
      "This appointment is too old to check in.",
    );
  });

  it("does not say 'scan the QR' for the same code join_queue uses for that", () => {
    const message = checkInErrorMessage(pg("P0004", "this appointment is too old to check in"));
    expect(message).not.toMatch(/scan/i);
    expect(joinQueueErrorMessage(pg("P0004", "scan the shop QR to join this queue"))).toMatch(
      /scan/i,
    );
  });

  it("still has something to say when P0004 arrives with no message", () => {
    expect(checkInErrorMessage(pg("P0004"))).toBe("You can't check in for this booking yet.");
  });

  it("names the plan gate and falls back otherwise", () => {
    expect(checkInErrorMessage(pg("P0001", "this shop is not running a queue"))).toBe(
      "This shop isn't running a queue.",
    );
    expect(checkInErrorMessage(pg("XX000"))).toBe("Couldn't check in.");
  });
});

describe("predicates", () => {
  it("recognises an already-in-this-line refusal, which is a redirect not a message", () => {
    expect(isAlreadyInLine(pg("P0003", "you are already in this queue"))).toBe(true);
    expect(isAlreadyInLine(pg("P0004"))).toBe(false);
    expect(isAlreadyInLine(null)).toBe(false);
  });

  it("recognises a needs-scan refusal", () => {
    expect(needsScan(pg("P0004"))).toBe(true);
    expect(needsScan(pg("P0003"))).toBe(false);
  });
});
