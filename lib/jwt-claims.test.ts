import { describe, expect, it } from "vitest";
import { jwtIsAnonymous } from "./jwt-claims";

/** A token with the given payload. The signature is never read, so it is a placeholder. */
function token(payload: Record<string, unknown>): string {
  const b64 = (s: string) =>
    Buffer.from(s, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(payload))}.sig`;
}

describe("jwtIsAnonymous", () => {
  it("reads a guest's claim", () => {
    expect(jwtIsAnonymous(token({ sub: "u1", is_anonymous: true }))).toBe(true);
  });

  it("reads a registered session's claim", () => {
    expect(jwtIsAnonymous(token({ sub: "u1", is_anonymous: false }))).toBe(false);
  });

  /*
    The server does `coalesce(… ->> 'is_anonymous', false)`, so an absent claim is a real
    account there. Answering `null` here instead would send a registered user to the guest
    wall on any token issued before the claim existed.
  */
  it("treats an absent claim as not-a-guest, matching the server's coalesce", () => {
    expect(jwtIsAnonymous(token({ sub: "u1" }))).toBe(false);
  });

  it("returns null when it cannot tell, so the caller falls back", () => {
    expect(jwtIsAnonymous(null)).toBeNull();
    expect(jwtIsAnonymous(undefined)).toBeNull();
    expect(jwtIsAnonymous("")).toBeNull();
    expect(jwtIsAnonymous("not-a-jwt")).toBeNull();
    expect(jwtIsAnonymous("a.b")).toBeNull();
    expect(jwtIsAnonymous("a.$$$.c")).toBeNull();
    // Valid base64url, but not JSON.
    expect(jwtIsAnonymous("a.aGVsbG8.c")).toBeNull();
    // JSON, but not an object.
    expect(jwtIsAnonymous("a.WzFd.c")).toBeNull();
    // Present but not a boolean — a shape we do not understand.
    expect(jwtIsAnonymous(token({ is_anonymous: "true" }))).toBeNull();
  });

  it("survives a non-ASCII payload rather than corrupting the parse", () => {
    expect(jwtIsAnonymous(token({ name: "Ugyen Zangmo · བཀྲ་ཤིས", is_anonymous: true }))).toBe(true);
  });
});
