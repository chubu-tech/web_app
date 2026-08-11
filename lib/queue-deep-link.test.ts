import { describe, expect, it } from "vitest";
import {
  businessIdFromQueueLink,
  queueLinkFor,
  ScanLatch,
} from "./queue-deep-link";

/**
 * Ports of `tho/app/test/queue_links_test.dart` and `scan_latch_test.dart`, same cases and same
 * expectations — plus three the web needs and the phone does not.
 */

describe("queueLinkFor", () => {
  it("builds the custom-scheme link the app's printed codes use", () => {
    expect(queueLinkFor("biz-123")).toBe("bhutansalons://q/biz-123");
  });
});

describe("businessIdFromQueueLink", () => {
  it("parses queueLinkFor's own output", () => {
    expect(businessIdFromQueueLink(queueLinkFor("biz-123"))).toBe("biz-123");
  });

  it("parses the custom-scheme shape directly", () => {
    expect(businessIdFromQueueLink("bhutansalons://q/biz-123")).toBe("biz-123");
  });

  it("parses the https shape, which is what this app's own QR encodes", () => {
    expect(businessIdFromQueueLink("https://bhutansalons.com/q/biz-123")).toBe("biz-123");
  });

  it("returns null for a junk or unrelated link", () => {
    expect(businessIdFromQueueLink("https://bhutansalons.com/business/biz-123")).toBeNull();
    expect(businessIdFromQueueLink("not-a-url")).toBeNull();
    expect(businessIdFromQueueLink("https://example.com/")).toBeNull();
  });

  /* --- beyond the Dart's cases ------------------------------------------------ */

  it("reads a real deployment's link, not just the production domain", () => {
    // The console generates the QR from the request's own host, so a preview deployment's
    // code must scan too — that is the whole reason `queue/page.tsx` builds it from headers.
    expect(businessIdFromQueueLink("http://localhost:3000/q/0b000000-1111")).toBe("0b000000-1111");
  });

  it("ignores anything after the id", () => {
    // A shortener or a scanner may append tracking. The id is the segment after `q`.
    expect(businessIdFromQueueLink("https://bhutansalons.com/q/biz-9?utm=poster")).toBe("biz-9");
    expect(businessIdFromQueueLink("https://bhutansalons.com/q/biz-9/extra")).toBe("biz-9");
  });

  it("returns null for a bare /q with nothing after it", () => {
    // Means "keep looking" to a scanner, never a join attempt against an empty id.
    expect(businessIdFromQueueLink("https://bhutansalons.com/q")).toBeNull();
    expect(businessIdFromQueueLink("https://bhutansalons.com/q/")).toBeNull();
    expect(businessIdFromQueueLink("bhutansalons://q")).toBeNull();
  });
});

describe("ScanLatch", () => {
  it("recognises a custom-scheme queue QR", () => {
    expect(new ScanLatch().businessIdFor("bhutansalons://q/abc-123")).toBe("abc-123");
  });

  it("recognises the https queue link shape", () => {
    expect(new ScanLatch().businessIdFor("https://bhutansalons.com/q/abc-123")).toBe("abc-123");
  });

  it("fires only once while the same code stays in frame", () => {
    const latch = new ScanLatch();
    expect(latch.businessIdFor("bhutansalons://q/abc-123")).toBe("abc-123");
    expect(latch.businessIdFor("bhutansalons://q/abc-123")).toBeNull();
    expect(latch.businessIdFor("bhutansalons://q/abc-123")).toBeNull();
  });

  it("does not latch on a code it does not recognise", () => {
    const latch = new ScanLatch();
    expect(latch.businessIdFor("https://example.com/hello")).toBeNull();
    expect(latch.businessIdFor("not a uri at all")).toBeNull();
    expect(latch.businessIdFor("")).toBeNull();
    expect(latch.businessIdFor(null)).toBeNull();
    // Still armed for a real code afterwards — the point of not latching.
    expect(latch.businessIdFor("bhutansalons://q/abc-123")).toBe("abc-123");
  });
});
