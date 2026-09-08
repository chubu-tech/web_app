import { describe, expect, it } from "vitest";
import { toQueueEntry } from "./api/mappers";
import {
  canCustomerLeave,
  canOwnerQueueTransition,
  etaMinutesFor,
  isTerminal,
  orderedFor,
  orderedShopWide,
  positionOf,
  queueLockState,
  queuePreview,
  queueShopSummary,
} from "./queue-logic";
import {
  deferredMinutesLeft,
  isDeferred,
  queueDisplayName,
  queueStatusFromWire,
  type QueueEntry,
  type QueueStatus,
} from "./types/queue";

/**
 * A port of `../tho/app/test/queue_logic_test.dart`, case for case with the same
 * expectations. **If either platform changes a queue rule, both suites change
 * together** — this is the arithmetic a customer is shown twice (projected in the
 * join form, recomputed in the live view), so a divergence here is a promise the
 * product breaks a few seconds after making it.
 *
 * The `toQueueEntry` cases are here rather than in a mapper test because the Dart
 * keeps them together, and for a good reason: the row shapes exist *for* these
 * functions, and the `queue_active_line` projection's missing `business_id` is only
 * a bug because of what reads it.
 */

const t0 = new Date(Date.UTC(2026, 6, 30, 3, 0));
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

function entry(
  id: string,
  {
    staff = null,
    priorityAt = null,
    joined,
    mins = 20,
    status = "waiting",
    servingLeft = 0,
    heldSecs = 0,
  }: {
    staff?: string | null;
    priorityAt?: Date | null;
    joined: Date;
    mins?: number;
    status?: QueueStatus;
    servingLeft?: number;
    /** Seconds left on a step-out hold. 0 is present. */
    heldSecs?: number;
  },
): QueueEntry {
  return {
    id,
    businessId: "b",
    staffMemberId: staff,
    serviceId: null,
    customerProfileId: null,
    bookingId: null,
    customerName: null,
    status,
    priorityAt,
    joinedAt: joined,
    serviceMinutes: mins,
    servingRemainingMinutes: servingLeft,
    deferredSecondsLeft: heldSecs,
    businessName: null,
    // Owner-board-only fields. Nothing in this file's arithmetic reads them — the
    // ordering and ETA rules are the same whether or not a name is attached.
    customerPhone: null,
    customerAvatarUrl: null,
  };
}

/** A `serving` entry with a known remainder — the shape most ETA cases need. */
const serving = (id: string, staff: string | null, mins: number, left: number) =>
  entry(id, { staff, joined: t0, mins, status: "serving", servingLeft: left });

describe("ordering", () => {
  it("puts a checked-in booking ahead of FIFO walk-ins on the same barber", () => {
    const all = [
      entry("w1", { staff: "s1", joined: t0 }),
      entry("bk", { staff: "s1", priorityAt: at(-5), joined: at(2) }),
      entry("w2", { staff: "s1", joined: at(1) }),
    ];
    expect(orderedFor("s1", all).map((e) => e.id)).toEqual(["bk", "w1", "w2"]);
  });

  it("shows Anyone entries in a specific barber's line", () => {
    const all = [
      entry("any", { staff: null, joined: t0 }),
      entry("s", { staff: "s1", joined: at(1) }),
    ];
    expect(orderedFor("s1", all).map((e) => e.id)).toEqual(["any", "s"]);
  });

  it("merges every barber into one priority-then-FIFO order shop-wide", () => {
    const line = [
      entry("w", { staff: "s1", joined: at(5) }),
      entry("bk", { staff: "s2", priorityAt: at(-5), joined: at(9) }),
      entry("any", { staff: null, joined: t0 }),
    ];
    expect(orderedShopWide(line).map((e) => e.id)).toEqual(["bk", "any", "w"]);
  });
});

describe("transitions", () => {
  it("allows only what set_queue_status allows", () => {
    expect(canOwnerQueueTransition("serving", "done")).toBe(true);
    expect(canOwnerQueueTransition("waiting", "no_show")).toBe(true);
    expect(canOwnerQueueTransition("waiting", "done")).toBe(false);
    expect(canCustomerLeave("waiting")).toBe(true);
    expect(canCustomerLeave("serving")).toBe(false);
  });

  it("round-trips every wire value and fails safe to waiting", () => {
    for (const status of ["waiting", "serving", "done", "no_show", "left"] as const) {
      expect(queueStatusFromWire(status)).toBe(status);
    }
    // Deliberately `waiting`, not terminal: an unknown status must not stop the
    // live view from polling.
    expect(queueStatusFromWire("nonsense")).toBe("waiting");
    expect(queueStatusFromWire(null)).toBe("waiting");
  });

  it("treats done, no_show and left as terminal", () => {
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("no_show")).toBe(true);
    expect(isTerminal("left")).toBe(true);
    expect(isTerminal("waiting")).toBe(false);
    expect(isTerminal("serving")).toBe(false);
  });
});

describe("toQueueEntry", () => {
  const base = { id: "e1", status: "waiting", joined_at: t0.toISOString() };

  it("takes businessName from a joined businesses(name), null otherwise", () => {
    expect(
      toQueueEntry({ ...base, business_id: "b1", businesses: { name: "Test Salon" } })
        .businessName,
    ).toBe("Test Salon");
    expect(toQueueEntry({ ...base, business_id: "b1" }).businessName).toBeNull();
  });

  it("parses a real queue_active_line row, which carries no business_id column", () => {
    // The exact projection of `public.queue_active_line` — PII-free, and
    // `business_id` is not among its columns.
    const row = {
      id: "e1",
      staff_member_id: null,
      status: "waiting",
      priority_at: null,
      joined_at: t0.toISOString(),
      service_minutes: 20,
      serving_remaining_min: 0,
    };
    expect(() => toQueueEntry(row)).not.toThrow();
    expect(toQueueEntry(row, "b1").businessId).toBe("b1");
  });

  it("lets an explicit business_id win over the fallback", () => {
    expect(toQueueEntry({ ...base, business_id: "b-real" }, "b-fallback").businessId).toBe(
      "b-real",
    );
  });

  it("prefers the services embed over a flat service_minutes column", () => {
    const e = toQueueEntry({
      ...base,
      business_id: "b1",
      services: { duration_minutes: 30 },
      service_minutes: 99,
    });
    expect(e.serviceMinutes).toBe(30);
  });

  it("falls back to a flat service_minutes column (the RPC shape)", () => {
    expect(toQueueEntry({ ...base, business_id: "b1", service_minutes: 35 }).serviceMinutes).toBe(
      35,
    );
  });

  it("defaults serviceMinutes to 20 when neither is present", () => {
    expect(toQueueEntry({ ...base, business_id: "b1" }).serviceMinutes).toBe(20);
  });

  it("parses the flat serving_remaining_min column", () => {
    const e = toQueueEntry({
      ...base,
      business_id: "b1",
      status: "serving",
      service_minutes: 20,
      serving_remaining_min: 15,
    });
    expect(e.servingRemainingMinutes).toBe(15);
  });

  it("defaults servingRemainingMinutes to 0 when the column is absent", () => {
    expect(toQueueEntry({ ...base, business_id: "b1" }).servingRemainingMinutes).toBe(0);
  });
});

describe("etaMinutesFor — a specific barber", () => {
  it("sums the durations ahead", () => {
    const all = [
      entry("a", { staff: "s1", joined: t0, mins: 25 }),
      entry("b", { staff: "s1", joined: at(1), mins: 15 }),
    ];
    expect(etaMinutesFor(all[1]!, all)).toBe(25);
    expect(positionOf(all[1]!, all)).toBe(2);
  });

  it("counts the in-progress cut, so the front of the line is not 0", () => {
    const line = [
      serving("busy", "s1", 40, 38),
      entry("me", { staff: "s1", joined: at(2), mins: 20 }),
    ];
    expect(positionOf(line[1]!, line)).toBe(1); // still first to be called
    expect(etaMinutesFor(line[1]!, line)).toBe(38); // but not free
  });

  it("adds the in-progress remainder on top of the entries ahead", () => {
    const line = [
      serving("busy", "s1", 30, 10),
      entry("w1", { staff: "s1", joined: at(1), mins: 25 }),
      entry("me", { staff: "s1", joined: at(2), mins: 20 }),
    ];
    expect(etaMinutesFor(line[2]!, line)).toBe(35);
  });

  it("counts nothing for a finished service", () => {
    const line = [
      serving("over", "s1", 20, 0),
      entry("me", { staff: "s1", joined: at(1), mins: 20 }),
    ];
    expect(etaMinutesFor(line[1]!, line)).toBe(0);
  });

  it("ignores barberCount entirely — the two cases do not bleed", () => {
    const line = [
      entry("a1", { staff: "s1", joined: t0, mins: 20 }),
      entry("b1", { staff: "s2", joined: at(1), mins: 40 }),
      entry("me", { staff: "s1", joined: at(2), mins: 20 }),
    ];
    expect(etaMinutesFor(line[2]!, line, { barberCount: 4 })).toBe(20);
  });

  it("does not quote a serving customer their own remaining cut", () => {
    const line = [serving("me", "s1", 30, 18)];
    expect(etaMinutesFor(line[0]!, line)).toBe(0);
  });
});

describe("etaMinutesFor — Anyone", () => {
  it("no longer reads an empty unassigned pool as a free shop", () => {
    const line = [
      entry("a1", { staff: "s1", joined: t0, mins: 20 }),
      entry("a2", { staff: "s1", joined: at(1), mins: 30 }),
      entry("b1", { staff: "s2", joined: at(2), mins: 20 }),
      entry("me", { staff: null, joined: at(9), mins: 20 }),
    ];
    expect(etaMinutesFor(line[3]!, line, { barberCount: 2 })).toBe(35); // 70 / 2
    // Shop-wide position too, so it agrees with the badge's waiting count.
    expect(positionOf(line[3]!, line)).toBe(4);
  });

  it("counts assigned waiting entries ahead, matching the shop-wide badge", () => {
    const line = [
      entry("w1", { staff: "s1", joined: t0, mins: 20 }),
      entry("me", { staff: null, joined: at(1), mins: 20 }),
    ];
    // Once #1, back when positionOf only looked at the Anyone pool while the
    // badge above it already counted the whole shop.
    expect(positionOf(line[1]!, line)).toBe(2);
  });

  it("leaves a specific-barber position unaffected", () => {
    const line = [
      entry("a", { staff: "s1", joined: t0, mins: 20 }),
      entry("any", { staff: null, joined: at(1), mins: 15 }),
      entry("other-barber", { staff: "s2", joined: at(2), mins: 99 }),
      entry("me", { staff: "s1", joined: at(3), mins: 20 }),
    ];
    expect(positionOf(line[3]!, line)).toBe(3); // a, any, me
  });

  it("counts in-progress cuts on every barber", () => {
    const line = [
      serving("busy1", "s1", 30, 12),
      serving("busy2", "s2", 40, 25),
      entry("w1", { staff: "s1", joined: at(1), mins: 20 }),
      entry("me", { staff: null, joined: at(9), mins: 20 }),
    ];
    // (12 + 25) serving + 20 waiting ahead = 57 over 2 barbers => ceil(28.5)
    expect(etaMinutesFor(line[3]!, line, { barberCount: 2 })).toBe(29);
  });

  it("gives one barber the undivided wait and cannot divide by zero", () => {
    const line = [
      entry("w1", { staff: "s1", joined: t0, mins: 25 }),
      entry("me", { staff: null, joined: at(9), mins: 20 }),
    ];
    expect(etaMinutesFor(line[1]!, line, { barberCount: 1 })).toBe(25);
    expect(etaMinutesFor(line[1]!, line, { barberCount: 0 })).toBe(25); // clamped to 1
  });

  it("uses the full roster when the line is all unassigned — nobody is busy", () => {
    const line = [
      entry("w1", { staff: null, joined: t0, mins: 20 }),
      entry("me", { staff: null, joined: at(1), mins: 20 }),
    ];
    expect(etaMinutesFor(line[1]!, line, { barberCount: 5 })).toBe(4); // ceil(20 / 5)
  });

  it("divides an idle roster and a partially-staffed one differently", () => {
    // Idle: nobody serving or assigned, so the whole 2-barber roster is free.
    const idle = [
      entry("w1", { staff: null, joined: t0, mins: 20 }),
      entry("me", { staff: null, joined: at(1), mins: 20 }),
    ];
    expect(etaMinutesFor(idle[1]!, idle, { barberCount: 2 })).toBe(10);

    // The same 20 minutes of work, but one barber is represented as serving it:
    // only that barber counts, not the roster.
    const partial = [serving("busy", "s1", 30, 20), entry("me2", { staff: null, joined: at(1), mins: 20 })];
    expect(etaMinutesFor(partial[1]!, partial, { barberCount: 2 })).toBe(20);
  });

  it("counts only barbers represented in the line, not the idle rest of the roster", () => {
    const line = [
      serving("busy", "s1", 30, 20),
      entry("w1", { staff: null, joined: at(1), mins: 20 }),
      entry("me", { staff: null, joined: at(2), mins: 20 }),
    ];
    // Only s1 is represented; the other 4 employed barbers must not shrink the wait.
    expect(etaMinutesFor(line[2]!, line, { barberCount: 5 })).toBe(40);
  });

  it("equals barberCount when every roster barber is actually busy", () => {
    const line = [
      serving("busy1", "s1", 30, 10),
      serving("busy2", "s2", 30, 20),
      entry("me", { staff: null, joined: at(1), mins: 20 }),
    ];
    expect(etaMinutesFor(line[2]!, line, { barberCount: 2 })).toBe(15); // ceil(30 / 2)
  });

  it("caps the divisor at barberCount even when more barbers show up", () => {
    const line = [
      serving("busy1", "s1", 30, 10),
      serving("busy2", "s2", 30, 10),
      serving("busy3", "s3", 30, 10),
      entry("me", { staff: null, joined: at(1), mins: 20 }),
    ];
    // 3 distinct barbers in the line, roster reports 2 — the cap holds at 2.
    expect(etaMinutesFor(line[3]!, line, { barberCount: 2 })).toBe(15); // ceil(30 / 2)
  });

  it("ignores waiting entries behind you", () => {
    const line = [
      entry("me", { staff: null, joined: t0, mins: 20 }),
      entry("later", { staff: "s1", joined: at(5), mins: 40 }),
    ];
    expect(etaMinutesFor(line[0]!, line, { barberCount: 1 })).toBe(0);
  });

  it("does not quote a serving customer with no preference their own remainder", () => {
    const line = [serving("me", null, 30, 22)];
    expect(etaMinutesFor(line[0]!, line, { barberCount: 2 })).toBe(0);
  });
});

describe("queuePreview", () => {
  it("projects a position and ETA for someone not yet in line", () => {
    const line = [
      entry("w1", { staff: "s1", joined: t0, mins: 25 }),
      entry("w2", { staff: "s1", joined: at(1), mins: 15 }),
    ];
    const p = queuePreview({ staffId: "s1", serviceMinutes: 20, line, barberCount: 1 });
    expect(p.position).toBe(3);
    expect(p.etaMinutes).toBe(40); // 25 + 15 ahead
  });

  it("matches what the same customer sees after joining (the anti-drift guarantee)", () => {
    const line = [serving("busy", "s1", 30, 18), entry("w1", { staff: "s1", joined: at(1), mins: 25 })];
    const preview = queuePreview({ staffId: "s1", serviceMinutes: 20, line, barberCount: 2 });

    // They join; the server hands back a real row with the same barber, service
    // length and a server-stamped join time.
    const joined = entry("real", { staff: "s1", joined: at(5), mins: 20 });
    const after = [...line, joined];
    expect(positionOf(joined, after)).toBe(preview.position);
    expect(etaMinutesFor(joined, after, { barberCount: 2 })).toBe(preview.etaMinutes);
  });

  it("is first with no wait on an empty line", () => {
    const p = queuePreview({ staffId: "s1", serviceMinutes: 20, line: [], barberCount: 1 });
    expect(p.position).toBe(1);
    expect(p.etaMinutes).toBe(0);
  });

  it("never displaces a checked-in booking", () => {
    const line = [entry("bk", { staff: "s1", priorityAt: at(60), joined: at(30), mins: 20 })];
    const p = queuePreview({ staffId: "s1", serviceMinutes: 20, line, barberCount: 1 });
    expect(p.position).toBe(2); // the booking keeps priority despite joining later
    expect(p.etaMinutes).toBe(20);
  });

  it("still lands behind a FIFO walk-in when the device clock lags the server's", () => {
    // Real joinedAt values are server-stamped. A browser whose clock is behind
    // must not let the ghost sort ahead of a real, non-priority entry — the ghost
    // is keyed off the line's own latest join, not off any clock.
    const line = [entry("w1", { staff: "s1", joined: at(10), mins: 25 })];
    const p = queuePreview({ staffId: "s1", serviceMinutes: 20, line, barberCount: 1 });
    expect(p.position).toBe(2);
    expect(p.etaMinutes).toBe(25);
  });
});

describe("queueShopSummary", () => {
  it("counts waiting heads and the walk-in-now wait", () => {
    const line = [
      serving("busy", "s1", 30, 12),
      entry("w1", { staff: "s1", joined: at(1), mins: 20 }),
      entry("w2", { staff: "s2", joined: at(2), mins: 30 }),
    ];
    const s = queueShopSummary({ line, barberCount: 2 });
    expect(s.waiting).toBe(2); // the serving customer is not "waiting"
    expect(s.etaMinutes).toBe(31); // ceil((12 + 20 + 30) / 2)
  });

  it("reads an empty line as no wait at all", () => {
    const s = queueShopSummary({ line: [], barberCount: 2 });
    expect(s.waiting).toBe(0);
    expect(s.etaMinutes).toBe(0);
  });
});

describe("queueLockState", () => {
  /*
    **`unavailable` has one cause now: the owner's switch.**

    It used to have two — the switch, or a plan that did not include the queue — and the
    plan half is gone. `20260902000003_queue_for_all_plans.sql` removed the
    `plan in ('growth','pro')` gate from `join_queue`, `check_in_booking` and
    `queue_active_line`, so a Basic salon with the switch on is `open` and a plan term here
    would refuse a customer the server would have taken. The two cases that used to assert
    "unavailable on Basic" are inverted below rather than deleted, because the inversion is
    the behaviour that changed.

    No live salon is `qr_only`, so that state's coverage is still tests-only.
  */
  const shop = (
    plan: "basic" | "growth" | "pro",
    queueEnabled: boolean,
    queueJoinMode: "anywhere" | "qr_only",
  ) => ({ plan, queueEnabled, queueJoinMode });

  it("opens for any salon with the queue switched on, that joins from anywhere", () => {
    expect(queueLockState(shop("growth", true, "anywhere"), false)).toBe("open");
    expect(queueLockState(shop("pro", true, "anywhere"), true)).toBe("open");
  });

  it("opens on Basic too — the queue is on every plan", () => {
    expect(queueLockState(shop("basic", true, "anywhere"), true)).toBe("open");
  });

  it("is unavailable when the owner switched the queue off, on any plan", () => {
    expect(queueLockState(shop("growth", false, "anywhere"), true)).toBe("unavailable");
    expect(queueLockState(shop("basic", false, "anywhere"), true)).toBe("unavailable");
  });

  it("asks for a scan at a qr_only salon reached any other way", () => {
    expect(queueLockState(shop("growth", true, "qr_only"), false)).toBe("needs_scan");
    expect(queueLockState(shop("growth", true, "qr_only"), true)).toBe("open");
    expect(queueLockState(shop("basic", true, "qr_only"), false)).toBe("needs_scan");
  });

  it("reports unavailable rather than needs_scan when the queue is off", () => {
    // "Scan to join" would be a lie at a shop that is running no queue at all.
    expect(queueLockState(shop("basic", false, "qr_only"), false)).toBe("unavailable");
  });
});

/**
 * The step-out hold, `20260902000005`.
 *
 * These four are the properties that were **proved against the live database on synthetic
 * rows** before the migration was applied, and this suite is what keeps the client's
 * comparator agreeing with `private.queue_front`'s leading
 * `(deferred_until is not null and deferred_until > now())` term. If the SQL's ordering ever
 * changes, these change with it — the customer is shown this arithmetic twice, projected in
 * the join form and recomputed in the live view seconds later.
 */
describe("the step-out hold in the ordering", () => {
  it("sorts someone who stepped out behind everyone present, however early they joined", () => {
    const line = [
      entry("held", { joined: at(0), heldSecs: 300 }),
      entry("b", { joined: at(5) }),
      entry("c", { joined: at(10) }),
    ];
    expect(orderedShopWide(line).map((e) => e.id)).toEqual(["b", "c", "held"]);
  });

  /*
    The property the whole design rests on. Nothing reaps a hold — `deferred_until > now()`
    simply stops being true — and because the row kept its `joined_at` the whole time, it
    lands back exactly where it was rather than at the back. That is what shops do for
    somebody who stepped out, and it is why the hold is a sort term and not a status.
  */
  it("returns a lapsed hold to its natural place, ahead of anyone who joined meanwhile", () => {
    const line = [
      entry("lapsed", { joined: at(0), heldSecs: 0 }),
      entry("joined-while-away", { joined: at(5) }),
    ];
    expect(orderedShopWide(line).map((e) => e.id)).toEqual(["lapsed", "joined-while-away"]);
  });

  it("puts a new joiner ahead of someone currently stepped out", () => {
    const line = [
      entry("held", { joined: at(0), heldSecs: 60 }),
      entry("new", { joined: at(30) }),
    ];
    expect(orderedShopWide(line).map((e) => e.id)).toEqual(["new", "held"]);
  });

  /*
    Presence beats priority, and this is the one case where a checked-in appointment loses.
    It is deliberate: the hold term leads the comparator in the SQL too. Somebody with a
    booking who walks out for ten minutes does not hold up the person standing at the
    counter — and gets their booked precedence back the moment they return.
  */
  it("lets presence beat priority while the hold runs, and priority win again after", () => {
    const held = entry("booked", { joined: at(0), priorityAt: at(0), heldSecs: 300 });
    const walkIn = entry("walk-in", { joined: at(20) });
    expect(orderedShopWide([held, walkIn]).map((e) => e.id)).toEqual(["walk-in", "booked"]);

    const back = { ...held, deferredSecondsLeft: 0 };
    expect(orderedShopWide([back, walkIn]).map((e) => e.id)).toEqual(["booked", "walk-in"]);
  });

  it("does not disturb the ordering of two people who have both stepped out", () => {
    const line = [
      entry("later", { joined: at(10), heldSecs: 100 }),
      entry("earlier", { joined: at(0), heldSecs: 100 }),
    ];
    expect(orderedShopWide(line).map((e) => e.id)).toEqual(["earlier", "later"]);
  });

  it("moves a held entry's position and ETA, since both read the same ordering", () => {
    const present = entry("present", { joined: at(5), mins: 30 });
    const held = entry("held", { joined: at(0), heldSecs: 300, mins: 20 });
    const line = [held, present];
    expect(positionOf(held, line)).toBe(2);
    // 30 minutes of the person now in front of them.
    expect(etaMinutesFor(held, line)).toBe(30);
  });
});

describe("deferral helpers", () => {
  it("treats a lapsed or absent hold as present", () => {
    expect(isDeferred({ deferredSecondsLeft: 0 })).toBe(false);
    expect(isDeferred({ deferredSecondsLeft: 1 })).toBe(true);
  });

  /*
    Rounded **up**, so a hold with one second on it reads "1 min" rather than the "0 min"
    that looks like it has already expired — on a countdown the customer is racing, the
    difference between those two is whether they think they still have a place.
  */
  it("rounds the minutes left up", () => {
    expect(deferredMinutesLeft({ deferredSecondsLeft: 1 })).toBe(1);
    expect(deferredMinutesLeft({ deferredSecondsLeft: 60 })).toBe(1);
    expect(deferredMinutesLeft({ deferredSecondsLeft: 61 })).toBe(2);
    expect(deferredMinutesLeft({ deferredSecondsLeft: 600 })).toBe(10);
  });
});

describe("queueDisplayName", () => {
  /*
    The board read `customerName ?? "Walk-in"` on both platforms, and `join_queue` only
    records `customer_name` for an entry a business member typed — so the barber called
    "Walk-in" to a line of people who had each given their name. The mapper folds the joined
    profile name in ahead of the typed one; this is the last step of the same rule.
  */
  it("falls back to Walk-in only when there is genuinely no name", () => {
    expect(queueDisplayName({ customerName: "Sonam" })).toBe("Sonam");
    expect(queueDisplayName({ customerName: "  Dechen  " })).toBe("Dechen");
    expect(queueDisplayName({ customerName: "   " })).toBe("Walk-in");
    expect(queueDisplayName({ customerName: null })).toBe("Walk-in");
  });
});
