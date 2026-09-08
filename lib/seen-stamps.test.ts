import { describe, expect, it } from "vitest";
import { seenStampsKey, stampArrival } from "./seen-stamps";

describe("seenStampsKey", () => {
  /**
   * Both ids, because a browser gets shared. A salon-only key would show one person's new stamps
   * to the next, and would silently suppress a real customer's celebration.
   */
  it("carries the account as well as the salon", () => {
    expect(seenStampsKey("acct", "biz")).toContain("acct");
    expect(seenStampsKey("acct", "biz")).toContain("biz");
    expect(seenStampsKey("acct", "biz")).not.toBe(seenStampsKey("other", "biz"));
    expect(seenStampsKey("acct", "biz")).not.toBe(seenStampsKey("acct", "other"));
  });
});

describe("stampArrival", () => {
  it("presents a first-ever load at rest, however full the card is", () => {
    expect(stampArrival({ lastSeen: null, filled: 4, total: 5 })).toEqual({
      animateFrom: 4,
      celebrate: false,
    });
    // Not even a card that is already complete — nobody is congratulated for a visit made in June.
    expect(stampArrival({ lastSeen: null, filled: 5, total: 5 })).toEqual({
      animateFrom: 5,
      celebrate: false,
    });
  });

  it("animates only what has arrived since the last look", () => {
    expect(stampArrival({ lastSeen: 2, filled: 4, total: 5 })).toEqual({
      animateFrom: 2,
      celebrate: false,
    });
  });

  it("celebrates the load that completes the card, and only that one", () => {
    expect(stampArrival({ lastSeen: 4, filled: 5, total: 5 }).celebrate).toBe(true);
    // Re-opening a card that was already full is a card at rest.
    expect(stampArrival({ lastSeen: 5, filled: 5, total: 5 })).toEqual({
      animateFrom: 5,
      celebrate: false,
    });
  });

  /**
   * The clamp that is invisible when it works and near-impossible to diagnose when it is missing:
   * redeeming lowers `filled`, and a marker stranded above it kills the next several
   * celebrations. The customer reports "the animation stopped working".
   */
  it("clamps a stale marker down after a redemption empties the card", () => {
    expect(stampArrival({ lastSeen: 5, filled: 0, total: 5 })).toEqual({
      animateFrom: 0,
      celebrate: false,
    });
    // And the very next visit animates again, rather than landing in silence.
    expect(stampArrival({ lastSeen: 5, filled: 1, total: 5 })).toEqual({
      animateFrom: 1,
      celebrate: false,
    });
  });

  it("survives nonsense in the store", () => {
    expect(stampArrival({ lastSeen: -3, filled: 2, total: 5 }).animateFrom).toBe(0);
    expect(stampArrival({ lastSeen: 1, filled: -2, total: 5 })).toEqual({
      animateFrom: 0,
      celebrate: false,
    });
    expect(stampArrival({ lastSeen: 0, filled: 0, total: 0 }).celebrate).toBe(false);
  });
});
