import { describe, expect, it } from "vitest";
import { whatsappDigits, whatsappUrl } from "./whatsapp";

/** A direct port of `tho/app/test/whatsapp_test.dart`. */

describe("whatsappDigits", () => {
  it("strips everything that is not a digit", () => {
    expect(whatsappDigits("+975 17 12 34 56")).toBe("97517123456");
    expect(whatsappDigits("(975) 17-123-456")).toBe("97517123456");
  });

  it("adds the Bhutan country code to a bare mobile number", () => {
    // The common case in a Bhutan-first app: locals type 8 digits.
    expect(whatsappDigits("17123456")).toBe("97517123456");
    expect(whatsappDigits("77123456")).toBe("97577123456");
  });

  it("leaves a number that already carries its country code alone", () => {
    expect(whatsappDigits("97517123456")).toBe("97517123456");
  });

  it("normalises a 00-prefixed international dial-out", () => {
    expect(whatsappDigits("0097517123456")).toBe("97517123456");
  });

  it("does not country-code an 8-digit number that is not a mobile", () => {
    // Bhutanese mobiles start 17 or 77; anything else 8 digits long is
    // something else, and guessing 975 would produce a wrong number.
    expect(whatsappDigits("23456789")).toBe("23456789");
  });

  it("rejects nothing usable", () => {
    expect(whatsappDigits(null)).toBeNull();
    expect(whatsappDigits("")).toBeNull();
    expect(whatsappDigits("   ")).toBeNull();
    expect(whatsappDigits("abc")).toBeNull();
  });

  it("rejects a fragment too short to be a real number", () => {
    expect(whatsappDigits("1234")).toBeNull();
    expect(whatsappDigits("+975")).toBeNull();
  });

  it("rejects anything longer than E.164 allows", () => {
    expect(whatsappDigits("1234567890123456")).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("builds a wa.me link", () => {
    expect(whatsappUrl("+975 17 12 34 56")).toBe("https://wa.me/97517123456");
  });

  it("pre-fills a message when given one", () => {
    expect(whatsappUrl("17123456", "Hi there")).toBe(
      "https://wa.me/97517123456?text=Hi%20there",
    );
  });

  it("omits an empty message rather than sending a blank text param", () => {
    expect(whatsappUrl("17123456", "   ")).toBe("https://wa.me/97517123456");
  });

  it("is null when the number is unusable, so callers can hide the action", () => {
    expect(whatsappUrl(null)).toBeNull();
    expect(whatsappUrl("nope")).toBeNull();
  });
});
