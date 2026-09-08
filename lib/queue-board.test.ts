import { describe, expect, it } from "vitest";
import {
  barberFor,
  etaForPositionIn,
  LONG_WAIT_MINUTES,
  queueBoardSummary,
  waitedLabel,
} from "./queue-board";
import { queueShopSummary } from "./queue-logic";
import type { QueueEntry, QueueStatus } from "./types/queue";
import type { StaffMember } from "./types/salon";

/**
 * Ports of `tho/app/test/queue_summary_test.dart`, plus the one property that matters most
 * and is easy to lose: **the owner's wait figure and the customer's badge come from the same
 * arithmetic.** The last test pins that directly rather than trusting the delegation.
 */

const t0 = new Date(Date.UTC(2026, 7, 4, 3, 0));
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

function entry(
  id: string,
  {
    staff = null,
    joined,
    mins = 20,
    status = "waiting",
    servingLeft = 0,
    priorityAt = null,
    name = null,
    heldSecs = 0,
  }: {
    staff?: string | null;
    joined: Date;
    mins?: number;
    status?: QueueStatus;
    servingLeft?: number;
    priorityAt?: Date | null;
    name?: string | null;
    /** Seconds left on a step-out hold. 0 is present. */
    heldSecs?: number;
  },
): QueueEntry {
  return {
    id,
    businessId: "biz",
    staffMemberId: staff,
    serviceId: null,
    customerProfileId: null,
    bookingId: null,
    customerName: name,
    status,
    priorityAt,
    joinedAt: joined,
    serviceMinutes: mins,
    servingRemainingMinutes: servingLeft,
    deferredSecondsLeft: heldSecs,
    businessName: null,
    customerPhone: null,
    customerAvatarUrl: null,
  };
}

function barber(id: string, displayName: string): StaffMember {
  return {
    id,
    displayName,
    role: "barber",
    isActive: true,
    profileId: null,
    photoUrl: null,
    businessId: "biz",
    commissionPct: 0,
    baseSalaryNu: 0,
  };
}

const sonam = barber("s1", "Sonam");
const tashi = barber("s2", "Tashi");
const karma = barber("s3", "Karma");

describe("queueBoardSummary", () => {
  it("reads quiet when nothing is waiting and no chair is busy", () => {
    const s = queueBoardSummary([], [sonam, tashi]);
    expect(s.isQuiet).toBe(true);
    expect(s.waiting).toBe(0);
    expect(s.nowServing).toEqual([]);
    expect(s.nextUp).toEqual([]);
    // Every barber is callable when nobody is in a chair.
    expect(s.freeBarbers.map((b) => b.id)).toEqual(["s1", "s2"]);
    expect(s.totalBarbers).toBe(2);
  });

  it("is not quiet while someone is in a chair, even with nobody waiting", () => {
    const s = queueBoardSummary(
      [entry("a", { staff: "s1", joined: t0, status: "serving", servingLeft: 10 })],
      [sonam, tashi],
    );
    expect(s.isQuiet).toBe(false);
    expect(s.waiting).toBe(0);
    expect(s.nowServing.map((e) => e.id)).toEqual(["a"]);
  });

  it("counts a busy barber out of freeBarbers but keeps them in the total", () => {
    const s = queueBoardSummary(
      [entry("a", { staff: "s2", joined: t0, status: "serving", servingLeft: 5 })],
      [sonam, tashi, karma],
    );
    expect(s.freeBarbers.map((b) => b.id)).toEqual(["s1", "s3"]);
    expect(s.totalBarbers).toBe(3);
  });

  it("orders nextUp priority-then-FIFO, shop-wide rather than per barber", () => {
    // A checked-in appointment carries `priority_at` and outranks walk-ins who joined
    // earlier; the rest are first-come. One list, whichever barber they asked for.
    const entries = [
      entry("walkin-early", { joined: at(0) }),
      entry("walkin-late", { staff: "s2", joined: at(30) }),
      entry("checked-in", { joined: at(20), priorityAt: at(10) }),
    ];
    const s = queueBoardSummary(entries, [sonam, tashi]);
    expect(s.nextUp.map((e) => e.id)).toEqual([
      "checked-in",
      "walkin-early",
      "walkin-late",
    ]);
    expect(s.waiting).toBe(3);
  });

  it("leaves a serving row out of nextUp", () => {
    const s = queueBoardSummary(
      [
        entry("in-chair", { staff: "s1", joined: at(0), status: "serving", servingLeft: 8 }),
        entry("waiting", { joined: at(5) }),
      ],
      [sonam],
    );
    expect(s.nextUp.map((e) => e.id)).toEqual(["waiting"]);
  });
});

describe("barberFor", () => {
  const s = queueBoardSummary([], [sonam, tashi]);

  it("names the barber a guest asked for", () => {
    expect(barberFor(s, entry("a", { staff: "s1", joined: t0 }))).toBe("Sonam");
  });

  it("says Anyone when the guest expressed no preference", () => {
    expect(barberFor(s, entry("a", { staff: null, joined: t0 }))).toBe("Anyone");
  });

  it("says Anyone for an id it cannot resolve, rather than showing a UUID", () => {
    // The board's roster read is allowed to fail on its own; entries still render.
    expect(barberFor(s, entry("a", { staff: "s9-gone", joined: t0 }))).toBe("Anyone");
  });
});

describe("etaForPositionIn", () => {
  it("is the remaining cuts plus the services ahead", () => {
    const entries = [
      entry("chair-1", { staff: "s1", joined: at(0), status: "serving", servingLeft: 10 }),
      entry("chair-2", { staff: "s2", joined: at(1), status: "serving", servingLeft: 5 }),
      entry("first", { joined: at(10), mins: 20 }),
      entry("second", { joined: at(11), mins: 30 }),
      entry("third", { joined: at(12), mins: 15 }),
    ];
    const s = queueBoardSummary(entries, [sonam, tashi]);

    // 10 + 5 left in the two chairs, and nobody ahead of the front of the line.
    expect(etaForPositionIn(s, 0)).toBe(15);
    expect(etaForPositionIn(s, 1)).toBe(15 + 20);
    expect(etaForPositionIn(s, 2)).toBe(15 + 20 + 30);
  });

  it("is 0 for the front of an idle shop, which the board renders as 'Up next'", () => {
    const s = queueBoardSummary([entry("first", { joined: t0, mins: 20 })], [sonam]);
    expect(etaForPositionIn(s, 0)).toBe(0);
  });
});

describe("the owner's figure and the customer's badge", () => {
  it("agree about the same line", () => {
    // The guarantee `queue_summary.dart` exists to keep, and the reason this file
    // delegates instead of computing: two screens quoting different waits for one shop is
    // worse than either being slightly wrong.
    const entries = [
      entry("chair", { staff: "s1", joined: at(0), status: "serving", servingLeft: 12 }),
      entry("w1", { joined: at(5), mins: 20 }),
      entry("w2", { staff: "s2", joined: at(6), mins: 30 }),
    ];
    const staff = [sonam, tashi];

    const owner = queueBoardSummary(entries, staff);
    const customer = queueShopSummary({ line: entries, barberCount: staff.length });

    expect(owner.etaMinutes).toBe(customer.etaMinutes);
    expect(owner.waiting).toBe(customer.waiting);
  });

  it("divides by one when the roster failed to load, so the wait is never understated", () => {
    // `staff` empty means the read failed, not that the shop has no barbers — quoting the
    // whole line against a single chair is the safe direction to be wrong in.
    const entries = [entry("w1", { joined: t0, mins: 20 }), entry("w2", { joined: at(1), mins: 20 })];
    const s = queueBoardSummary(entries, []);
    expect(s.totalBarbers).toBe(0);
    expect(s.etaMinutes).toBe(40);
  });
});

/**
 * The stepped-out tally, `20260902000005`.
 *
 * The board has to say it because the ordering hides it: a held row sorts to the end of the
 * line, so a shop with three people out looks, from the top of the screen, like a shop with
 * three people who joined late.
 */
describe("steppedOut", () => {
  it("counts waiting heads that are currently held, and no others", () => {
    const s = queueBoardSummary(
      [
        entry("present", { joined: at(0) }),
        entry("out", { joined: at(1), heldSecs: 240 }),
        entry("also-out", { joined: at(2), heldSecs: 30 }),
        entry("lapsed", { joined: at(3), heldSecs: 0 }),
        entry("in-chair", { joined: at(4), status: "serving", servingLeft: 10 }),
      ],
      [],
    );
    expect(s.steppedOut).toBe(2);
  });

  /*
    Held heads stay in `waiting`, because they have not left — which is the whole point of a
    hold. If this ever drops to 3 the strip and the list are counting different lines.
  */
  it("leaves them in the waiting count, since they still hold a place", () => {
    const s = queueBoardSummary(
      [
        entry("present", { joined: at(0) }),
        entry("out", { joined: at(1), heldSecs: 240 }),
        entry("also-out", { joined: at(2), heldSecs: 30 }),
        entry("another", { joined: at(3) }),
      ],
      [],
    );
    expect(s.waiting).toBe(4);
    expect(s.steppedOut).toBe(2);
    // And the ordering has put both of them at the back.
    expect(s.nextUp.map((e) => e.id)).toEqual(["present", "another", "out", "also-out"]);
  });

  it("is zero in an ordinary shop, which is why the strip only states it when it is not", () => {
    const s = queueBoardSummary([entry("a", { joined: at(0) })], []);
    expect(s.steppedOut).toBe(0);
  });
});

/**
 * The fairness line. Injected clock, so these are exact rather than approximately true —
 * the same reason `booking-status-rules.ts` takes a `now`.
 */
describe("waitedLabel", () => {
  const now = new Date(Date.UTC(2026, 8, 8, 10, 0));
  const ago = (m: number) => new Date(now.getTime() - m * 60_000);

  it("says just joined under a minute, and counts minutes after that", () => {
    expect(waitedLabel(ago(0), now).label).toBe("just joined");
    expect(waitedLabel(ago(0.9), now).label).toBe("just joined");
    expect(waitedLabel(ago(1), now).label).toBe("waited 1m");
    expect(waitedLabel(ago(37), now).label).toBe("waited 37m");
  });

  /*
    Capped rather than counting on. Past an hour the exact figure stops changing what the
    owner should do, and a three-digit number is the row's width spent on precision nobody
    acts on.
  */
  it("caps at an hour", () => {
    expect(waitedLabel(ago(59), now).label).toBe("waited 59m");
    expect(waitedLabel(ago(60), now).label).toBe("waited 1h+");
    expect(waitedLabel(ago(600), now).label).toBe("waited 1h+");
  });

  it("warms at twenty minutes, which is about one cut", () => {
    expect(waitedLabel(ago(19), now).long).toBe(false);
    expect(waitedLabel(ago(LONG_WAIT_MINUTES), now).long).toBe(true);
    expect(waitedLabel(ago(90), now).long).toBe(true);
  });

  // A clock that has drifted backwards must not produce "waited -3m".
  it("does not go negative on a future join time", () => {
    expect(waitedLabel(new Date(now.getTime() + 60_000), now).label).toBe("just joined");
  });
});
