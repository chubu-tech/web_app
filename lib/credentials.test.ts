import { describe, expect, it } from "vitest";
import {
  emailError,
  MIN_PASSWORD_LENGTH,
  nameError,
  newPasswordError,
  signInPasswordError,
} from "./credentials";

describe("emailError", () => {
  it("accepts the addresses people actually have", () => {
    for (const email of [
      "a@b.co",
      "sonam.dorji@gmail.com",
      "norzin+bookings@salon.bt",
      "o'neill@example.co.uk",
      "UPPER@EXAMPLE.COM",
    ]) {
      expect(emailError(email)).toBeNull();
    }
  });

  it("trims before judging, so a pasted address with padding passes", () => {
    expect(emailError("  sonam@example.com  ")).toBeNull();
  });

  /*
    The order of these branches is the behaviour. Each message names the *actual* problem,
    which is the whole reason this module exists — the server's own reply talks about the
    request rather than about what the person should type.
  */
  it("names the specific problem rather than just refusing", () => {
    expect(emailError("")).toBe("Enter your email.");
    expect(emailError("   ")).toBe("Enter your email.");
    expect(emailError("son am@example.com")).toBe("An email address can't contain spaces.");
    expect(emailError("sonam")).toBe("An email address needs an @.");
    expect(emailError("sonam@")).toBe("That doesn't look like an email address.");
    expect(emailError("a@b")).toBe("That doesn't look like an email address.");
    expect(emailError("a@b.c")).toBe("That doesn't look like an email address.");
  });

  it("catches the space before the pattern, so the message is the useful one", () => {
    // Both faults at once: without the ordering this would read "doesn't look like an email".
    expect(emailError("a b")).toBe("An email address can't contain spaces.");
  });
});

describe("newPasswordError", () => {
  it("accepts a password with a letter, a number and the length", () => {
    expect(newPasswordError("haircut1")).toBeNull();
    expect(newPasswordError("Thimphu2026!")).toBeNull();
  });

  it("asks for the three things it needs, one at a time", () => {
    expect(newPasswordError("")).toBe("Choose a password.");
    expect(newPasswordError("short1")).toBe(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    // The case a length rule alone lets through.
    expect(newPasswordError("aaaaaaaa")).toBe("Include at least one number.");
    expect(newPasswordError("12345678")).toBe("Include at least one letter.");
  });

  it("is stricter than Supabase's own six-character floor", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThan(6);
    expect(newPasswordError("abc123")).not.toBeNull();
  });
});

/*
  **The split that matters.** Somebody who set a six-character password before this rule
  existed still has to get into their account. Applying the sign-up rule at sign-in would
  tell them their correct password is too short, which is a lie about why they cannot log in.
*/
describe("signInPasswordError", () => {
  it("only refuses an empty field", () => {
    expect(signInPasswordError("")).toBe("Enter your password.");
    expect(signInPasswordError("abc")).toBeNull();
    // A pre-existing six-character password: rejected for sign-up, accepted for sign-in.
    expect(newPasswordError("abc123")).not.toBeNull();
    expect(signInPasswordError("abc123")).toBeNull();
  });
});

describe("nameError", () => {
  it("wants something that is not whitespace", () => {
    expect(nameError("")).toBe("Enter your name.");
    expect(nameError("   ")).toBe("Enter your name.");
    expect(nameError("Sonam")).toBeNull();
  });
});
