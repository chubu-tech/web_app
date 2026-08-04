import { describe, expect, it } from "vitest";
import { barberFor, etaForPositionIn, queueBoardSummary } from "./queue-board";
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
  }: {
    staff?: string | null;
    joined: Date;
    mins?: number;
    status?: QueueStatus;
    servingLeft?: number;
    priorityAt?: Date | null;
    name?: string | null;
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
