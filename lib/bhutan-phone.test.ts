import { describe, expect, it } from "vitest";
import {
  bhutanPhoneError,
  formatLocal,
  isValidBhutanPhone,
  toE164,
  toLocal,
} from "./bhutan-phone";

/*
  A port of `../tho/app/test/bhutan_phone_test.dart`, with the same cases and the same
  expectations — the repo convention for ported logic, and the thing that keeps the two
  clients agreeing about what a phone number is.
*/

describe("toLocal", () => {
  it("leaves a bare local number alone", () => {
    expect(toLocal("17123456")).toBe("17123456");
    expect(toLocal("77123456")).toBe("77123456");
  });

  it("strips everything people actually paste", () => {
    expect(toLocal("+975 17 12 34 56")).toBe("17123456");
    expect(toLocal("+97517123456")).toBe("17123456");
    expect(toLocal("97517123456")).toBe("17123456");
    expect(toLocal("0097517123456")).toBe("17123456");
    expect(toLocal("975-17123456")).toBe("17123456");
    expect(toLocal("(975) 17123456")).toBe("17123456");
  });

  /*
    The length check earning its place: `975…` is only a country code when what follows it is
    a whole local number. Stripping on the prefix alone would eat the first three digits of a
    number that merely starts with those digits.
  */
  it("does not mistake leading 975 digits for a country code", () => {
    expect(toLocal("97512345")).toBe("97512345");
  });

  it("returns what it has while somebody is still typing", () => {
    expect(toLocal("171")).toBe("171");
    expect(toLocal("")).toBe("");
  });
});

describe("bhutanPhoneError", () => {
  it("accepts both live prefixes, however they were typed", () => {
    expect(bhutanPhoneError("17123456", { required: true })).toBeNull();
    expect(bhutanPhoneError("77123456", { required: true })).toBeNull();
    expect(bhutanPhoneError("+975 17 12 34 56", { required: true })).toBeNull();
  });

  /*
    `required` changes the meaning of **empty** and nothing else. On a salon's own phone an
    empty field is a missing answer; on a walk-in customer's it is "didn't ask".
  */
  it("only lets `required` decide what empty means", () => {
    expect(bhutanPhoneError("", { required: true })).not.toBeNull();
    expect(bhutanPhoneError("")).toBeNull();
    expect(bhutanPhoneError("   ")).toBeNull();
  });

  it("counts the digits still missing, and gets the plural right", () => {
    expect(bhutanPhoneError("1712345", { required: true })).toContain("1 more digit");
    expect(bhutanPhoneError("171234", { required: true })).toContain("2 more digits");
  });

  it("says when there are too many", () => {
    expect(bhutanPhoneError("171234567", { required: true })).toContain("more than 8");
  });

  it("rejects a landline, naming the prefixes that work", () => {
    // Neither can receive SMS or WhatsApp, which is what these fields are for.
    expect(bhutanPhoneError("02345678", { required: true })).toContain("17 or 77");
    expect(bhutanPhoneError("12345678", { required: true })).toContain("17 or 77");
  });

  /*
    The case the free-text fields let through: **a half-typed number is wrong even in an
    optional field.** Left blank it is a decision; typed half-way it is a typo, and stored it
    renders a WhatsApp button that goes nowhere.
  */
  it("rejects a partial number even when the field is optional", () => {
    expect(bhutanPhoneError("1712")).not.toBeNull();
  });
});

describe("toE164", () => {
  it("stores the dialable form", () => {
    expect(toE164("17123456")).toBe("+97517123456");
    expect(toE164("17 12 34 56")).toBe("+97517123456");
    expect(toE164("+975 17123456")).toBe("+97517123456");
  });

  it("is null rather than a guess when the number is not usable", () => {
    expect(toE164("1712")).toBeNull();
    expect(toE164("")).toBeNull();
    expect(toE164("02345678")).toBeNull();
  });
});

describe("formatLocal", () => {
  it("groups a complete number the way it is read aloud", () => {
    expect(formatLocal("17123456")).toBe("17 12 34 56");
    expect(formatLocal("+97577123456")).toBe("77 12 34 56");
  });

  it("leaves an incomplete number ungrouped, so it cannot look finished", () => {
    expect(formatLocal("1712")).toBe("1712");
  });
});

it("isValidBhutanPhone is the same rule as the error message", () => {
  expect(isValidBhutanPhone("17123456")).toBe(true);
  expect(isValidBhutanPhone("1712345")).toBe(false);
  expect(isValidBhutanPhone("")).toBe(false);
});
