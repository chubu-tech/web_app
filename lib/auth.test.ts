import { describe, expect, it } from "vitest";
import { friendlyAuthError, isGuestUser } from "./auth";
import type { User } from "@supabase/supabase-js";

const user = (over: Partial<User> = {}) => ({ id: "u1", ...over }) as User;

describe("isGuestUser", () => {
  it("counts no session as a guest — nothing is committed either way", () => {
    expect(isGuestUser(null)).toBe(true);
  });

  it("counts an anonymous session as a guest", () => {
    expect(isGuestUser(user({ is_anonymous: true }))).toBe(true);
  });

  it("counts a registered session as real", () => {
    expect(isGuestUser(user({ is_anonymous: false }))).toBe(false);
    // An older session with no flag at all is a real account, matching the server's coalesce.
    expect(isGuestUser(user())).toBe(false);
  });
});

/*
  These are matched on message substrings, which is fragile — and it is what the app does
  (`_friendly` in `email_sign_in_screen.dart`), because gotrue's codes are not stable across
  versions either. The cases below are the failures people actually hit; the point of the
  suite is that each one keeps saying the thing the person can act on.
*/
describe("friendlyAuthError", () => {
  it("tells a guest to sign out when the email belongs to another account", () => {
    /*
      **"Sign out", not "try signing in", and that is the whole point of this case.** The
      account is under a different user id, so upgrading *this* anonymous session can never
      reach it — telling them to sign in from a sheet that is trying to upgrade a guest is an
      instruction that does nothing.
    */
    for (const message of [
      "User already registered",
      "A user with this email address has already been registered",
      "email_exists",
      "Email address is already in use by another user",
    ]) {
      expect(friendlyAuthError({ message })).toBe(
        "That email already has an account. Sign out and sign in with it instead.",
      );
    }
  });

  it("names a malformed email rather than blaming the request", () => {
    expect(friendlyAuthError({ message: "Unable to validate email address: invalid format" })).toBe(
      "That email address doesn't look right.",
    );
    expect(friendlyAuthError({ message: "email_address_invalid" })).toBe(
      "That email address doesn't look right.",
    );
  });

  it("sends a refused anonymous upgrade to sign-in instead of looping", () => {
    expect(friendlyAuthError({ message: "Manual linking is disabled for anonymous users" })).toBe(
      "Guest accounts can't be upgraded right now. Please sign in instead.",
    );
  });

  it("keeps the sign-in failures it already handled", () => {
    expect(friendlyAuthError({ message: "Invalid login credentials" })).toBe(
      "Wrong email or password.",
    );
    expect(friendlyAuthError({ message: "Email not confirmed" })).toBe(
      "Please confirm your email first — check your inbox.",
    );
    expect(friendlyAuthError({ message: "Password should be at least 6 characters" })).toBe(
      "Password must be at least 6 characters.",
    );
  });

  it("falls back without leaking raw exception text into the UI", () => {
    expect(friendlyAuthError({ message: "PGRST301: jwt expired somewhere deep" })).toBe(
      "Something went wrong. Please try again.",
    );
    expect(friendlyAuthError("a bare string")).toBe("Something went wrong. Please try again.");
    expect(friendlyAuthError(null)).toBe("Something went wrong. Please try again.");
  });
});
