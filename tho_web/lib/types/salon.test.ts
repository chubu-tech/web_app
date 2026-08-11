import { describe, expect, it } from "vitest";
import { runsQueue } from "./salon";

/**
 * `runsQueue` is the predicate the owner's queue board gates on, and the reason it exists
 * is a divergence from the Flutter app: `queue_board.dart` checks the **plan alone**, so a
 * Growth salon whose owner switched the queue off in Settings still gets a live,
 * four-second-polling board with a working Call next — while `join_queue` refuses its
 * customers with `P0001 'this shop is not running a queue'`.
 *
 * It is already exercised through `queueLockState` in `queue-logic.test.ts`, but the board
 * calls this directly, so the two conditions are pinned here as well. **Neither combination
 * below has a live example**: every salon on the platform has `queue_enabled = true`, so the
 * switched-off case can only ever be covered by a test.
 */
describe("runsQueue", () => {
  it("needs the plan and the owner's own switch", () => {
    expect(runsQueue({ plan: "growth", queueEnabled: true })).toBe(true);
    expect(runsQueue({ plan: "pro", queueEnabled: true })).toBe(true);
  });

  it("is false on a plan without the queue, however the switch is set", () => {
    expect(runsQueue({ plan: "basic", queueEnabled: true })).toBe(false);
    expect(runsQueue({ plan: "basic", queueEnabled: false })).toBe(false);
  });

  it("is false when an entitled owner has switched it off — the case the app gets wrong", () => {
    expect(runsQueue({ plan: "growth", queueEnabled: false })).toBe(false);
    expect(runsQueue({ plan: "pro", queueEnabled: false })).toBe(false);
  });
});
