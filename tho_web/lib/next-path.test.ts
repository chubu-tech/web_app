import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "./next-path";

/**
 * These are the cases that make `?next=` safe to follow. There is no Dart original —
 * the Flutter app has no URL to be redirected to — so this is web-only ground and gets
 * its own coverage. An open redirect on a sign-in page is how a real site gets used to
 * phish its own users.
 *
 * Control characters are written as escapes rather than typed literally, so this file
 * stays reviewable text rather than something git treats as binary.
 */
/** A path carrying one control character, built by code point so this source file
 *  contains none of the bytes it is testing for. */
const withControl = (code: number) => `/salon${String.fromCharCode(code)}/abc`;

describe("safeNext", () => {
  it("keeps a same-origin path", () => {
    expect(safeNext("/salon/abc")).toBe("/salon/abc");
    expect(safeNext("/bookings?tab=Completed")).toBe("/bookings?tab=Completed");
    expect(safeNext("/salon/abc#reviews")).toBe("/salon/abc#reviews");
  });

  it("falls back when there is nothing to follow", () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
  });

  it("refuses an absolute URL", () => {
    expect(safeNext("https://evil.example/login")).toBe(DEFAULT_NEXT);
    expect(safeNext("http://evil.example")).toBe(DEFAULT_NEXT);
  });

  it("refuses a protocol-relative URL", () => {
    // The one people forget: `//evil.example` is not a path, it is a host.
    expect(safeNext("//evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\\evil.example")).toBe(DEFAULT_NEXT);
  });

  it("refuses a protocol-relative URL hidden by encoding", () => {
    expect(safeNext("%2F%2Fevil.example")).toBe(DEFAULT_NEXT);
    expect(safeNext("%2f%2fevil.example/path")).toBe(DEFAULT_NEXT);
  });

  it("refuses a scheme that isn't http", () => {
    expect(safeNext("javascript:alert(1)")).toBe(DEFAULT_NEXT);
    expect(safeNext("data:text/html,<script>")).toBe(DEFAULT_NEXT);
    expect(safeNext("mailto:someone@example.com")).toBe(DEFAULT_NEXT);
  });

  it("refuses control characters", () => {
    expect(safeNext(withControl(0x00))).toBe(DEFAULT_NEXT);
    expect(safeNext(withControl(0x1f))).toBe(DEFAULT_NEXT);
    expect(safeNext(withControl(0x7f))).toBe(DEFAULT_NEXT);
    expect(safeNext("/salon\r\nSet-Cookie: x=1")).toBe(DEFAULT_NEXT);
  });

  it("refuses a CRLF payload that trimming would have hidden", () => {
    // The bug this caught: `trim()` used to run first, stripping the CRLF and leaving
    // an innocuous-looking `/evil` that passed every remaining check.
    expect(safeNext("%0d%0a/evil")).toBe(DEFAULT_NEXT);
    expect(safeNext("\r\n/evil")).toBe(DEFAULT_NEXT);
  });

  it("refuses malformed percent-encoding rather than guessing", () => {
    expect(safeNext("%")).toBe(DEFAULT_NEXT);
    expect(safeNext("/salon/%E0%A4%A")).toBe(DEFAULT_NEXT);
  });

  it("does not bounce back to the auth pages", () => {
    // Otherwise signing in returns you to the sign-in page you just left.
    expect(safeNext("/sign-in")).toBe(DEFAULT_NEXT);
    expect(safeNext("/sign-in?next=/sign-in")).toBe(DEFAULT_NEXT);
    expect(safeNext("/sign-up")).toBe(DEFAULT_NEXT);
  });

  it("tolerates ordinary surrounding whitespace", () => {
    expect(safeNext("  /bookings  ")).toBe("/bookings");
  });
});
