import { describe, expect, it } from "vitest";
import { isMine, isUnreadFor, relativeAge, threadPreview, unreadThreadCount } from "./chat-logic";

/**
 * Ported from `Conversation.isUnreadFor` in `../tho/app/lib/data/models.dart:364`.
 *
 * The two carve-outs both have live examples in the seed, which is why they are
 * separate cases rather than one "unread" test.
 */

const CUSTOMER = "cust-1";
const SALON_MEMBER = "owner-1";

const thread = ({
  lastMessageAt = null,
  customerLastReadAt = null,
  businessLastReadAt = null,
}: {
  lastMessageAt?: Date | null;
  customerLastReadAt?: Date | null;
  businessLastReadAt?: Date | null;
}) => ({
  customerProfileId: CUSTOMER,
  lastMessageAt,
  customerLastReadAt,
  businessLastReadAt,
});

const t = (iso: string) => new Date(iso);

describe("isUnreadFor", () => {
  it("never treats a thread with no messages as unread", () => {
    // The live Clock Tower Cuts thread: opened, never written in.
    const empty = thread({ lastMessageAt: null, customerLastReadAt: t("2026-08-02T03:01:10Z") });
    expect(isUnreadFor(empty, CUSTOMER)).toBe(false);
    expect(isUnreadFor(empty, SALON_MEMBER)).toBe(false);
  });

  it("is unread for a side that has never opened it", () => {
    const c = thread({ lastMessageAt: t("2026-08-02T03:00:00Z") });
    expect(isUnreadFor(c, CUSTOMER)).toBe(true);
    expect(isUnreadFor(c, SALON_MEMBER)).toBe(true);
  });

  it("answers differently for the two sides", () => {
    // The customer has read past the last message; the salon has not.
    const c = thread({
      lastMessageAt: t("2026-08-02T03:00:00Z"),
      customerLastReadAt: t("2026-08-02T03:05:00Z"),
      businessLastReadAt: t("2026-08-02T02:00:00Z"),
    });
    expect(isUnreadFor(c, CUSTOMER)).toBe(false);
    expect(isUnreadFor(c, SALON_MEMBER)).toBe(true);
  });

  it("clears once the reader's own timestamp passes the last message", () => {
    const c = thread({
      lastMessageAt: t("2026-08-02T03:00:59Z"),
      customerLastReadAt: t("2026-08-02T03:01:05Z"),
      businessLastReadAt: t("2026-08-02T03:02:18Z"),
    });
    // Both live read timestamps are after the last message, as in the seed.
    expect(isUnreadFor(c, CUSTOMER)).toBe(false);
    expect(isUnreadFor(c, SALON_MEMBER)).toBe(false);
  });

  it("is not unread when read at exactly the last message", () => {
    const at = t("2026-08-02T03:00:00Z");
    expect(isUnreadFor(thread({ lastMessageAt: at, customerLastReadAt: at }), CUSTOMER)).toBe(
      false,
    );
  });

  /**
   * The gap this function cannot close, pinned so nobody "fixes" it here by accident.
   *
   * `last_message` is denormalised text with no sender, so a thread whose newest message
   * is the reader's own is indistinguishable from one where the other side wrote. The
   * comparison therefore says "unread", and it is the send path's job to bump the
   * reader's timestamp — see `chat-thread.tsx`. The Dart original claims the carve-out in
   * its comment and has the same gap, which showed up as your own thread going bold.
   */
  it("cannot tell who wrote the last message, so the send path must mark read", () => {
    const justSentByMe = thread({
      lastMessageAt: t("2026-08-04T08:11:23Z"),
      customerLastReadAt: t("2026-08-04T08:11:22Z"), // read a second BEFORE sending
    });
    expect(isUnreadFor(justSentByMe, CUSTOMER)).toBe(true);

    // With the read stamp moved forward after the send, as `chat-thread.tsx` does:
    const afterMarkingRead = thread({
      lastMessageAt: t("2026-08-04T08:11:23Z"),
      customerLastReadAt: t("2026-08-04T08:11:24Z"),
    });
    expect(isUnreadFor(afterMarkingRead, CUSTOMER)).toBe(false);
  });

  it("treats an unidentified reader as the salon side", () => {
    // No viewer id means we cannot claim to be the customer, so the question falls to
    // the business timestamp rather than silently reading as "all caught up".
    const c = thread({
      lastMessageAt: t("2026-08-02T03:00:00Z"),
      customerLastReadAt: t("2026-08-02T04:00:00Z"),
      businessLastReadAt: null,
    });
    expect(isUnreadFor(c, null)).toBe(true);
  });
});

describe("unreadThreadCount", () => {
  it("counts only the threads with something new for that reader", () => {
    const list = [
      thread({ lastMessageAt: t("2026-08-02T03:00:00Z") }), // unread for both
      thread({
        lastMessageAt: t("2026-08-02T03:00:00Z"),
        customerLastReadAt: t("2026-08-02T04:00:00Z"),
      }), // read by the customer
      thread({ lastMessageAt: null }), // empty
    ];
    expect(unreadThreadCount(list, CUSTOMER)).toBe(1);
    expect(unreadThreadCount(list, SALON_MEMBER)).toBe(2);
    expect(unreadThreadCount([], CUSTOMER)).toBe(0);
  });
});

describe("isMine", () => {
  it("is true only for the reader's own messages", () => {
    expect(isMine({ senderProfileId: CUSTOMER }, CUSTOMER)).toBe(true);
    expect(isMine({ senderProfileId: SALON_MEMBER }, CUSTOMER)).toBe(false);
    expect(isMine({ senderProfileId: CUSTOMER }, null)).toBe(false);
  });
});

describe("threadPreview", () => {
  it("uses the denormalised last message", () => {
    expect(threadPreview({ lastMessage: "Are you open now?" })).toEqual({
      text: "Are you open now?",
      empty: false,
    });
  });

  it("says so for an opened-but-empty thread rather than showing a blank line", () => {
    expect(threadPreview({ lastMessage: null }).empty).toBe(true);
    expect(threadPreview({ lastMessage: "   " }).empty).toBe(true);
    expect(threadPreview({ lastMessage: null }).text).toBe("No messages yet");
  });
});

describe("relativeAge", () => {
  const now = t("2026-08-04T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("matches the app's scale", () => {
    expect(relativeAge(ago(30_000), now)).toBe("now");
    expect(relativeAge(ago(5 * 60_000), now)).toBe("5m");
    expect(relativeAge(ago(3 * 3_600_000), now)).toBe("3h");
    expect(relativeAge(ago(2 * 86_400_000), now)).toBe("2d");
    expect(relativeAge(ago(28 * 86_400_000), now)).toBe("4w");
  });

  it("steps at each boundary rather than overlapping", () => {
    expect(relativeAge(ago(59_000), now)).toBe("now");
    expect(relativeAge(ago(60_000), now)).toBe("1m");
    expect(relativeAge(ago(59 * 60_000), now)).toBe("59m");
    expect(relativeAge(ago(60 * 60_000), now)).toBe("1h");
    expect(relativeAge(ago(23 * 3_600_000), now)).toBe("23h");
    expect(relativeAge(ago(24 * 3_600_000), now)).toBe("1d");
    expect(relativeAge(ago(6 * 86_400_000), now)).toBe("6d");
    expect(relativeAge(ago(7 * 86_400_000), now)).toBe("1w");
  });

  it("reads a future timestamp as 'now' rather than a negative age", () => {
    // Clock skew between the browser and the server stamp is ordinary; "-2m" is not.
    expect(relativeAge(new Date(now.getTime() + 120_000), now)).toBe("now");
  });
});
