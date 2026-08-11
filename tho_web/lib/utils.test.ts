import { describe, expect, it } from "vitest";
import { formatDuration, formatNu, initials } from "./utils";

describe("initials", () => {
  it("takes the first and last name", () => {
    expect(initials("Sonam Dorji")).toBe("SD");
  });

  it("takes one letter from a single name", () => {
    expect(initials("Tashi")).toBe("T");
  });

  it("ignores a parenthetical role — live staff names carry them", () => {
    // "Tashi (Owner)" rendered as `T(` before: the last "word" was "(Owner)".
    expect(initials("Tashi (Owner)")).toBe("TO");
    expect(initials("Sonam Dorji (staff)")).toBe("SS");
  });

  it("falls back to ? for nothing usable", () => {
    expect(initials(null)).toBe("?");
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
    expect(initials("()")).toBe("?");
  });
});

describe("formatNu", () => {
  it("writes Ngultrum the way the app does", () => {
    expect(formatNu(300)).toBe("Nu 300");
    expect(formatNu(1200)).toBe("Nu 1,200");
  });

  it("rounds rather than showing fractional chetrum", () => {
    expect(formatNu(349.5)).toBe("Nu 350");
  });
});

describe("formatDuration", () => {
  it("reads minutes under an hour", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("drops a zero minute remainder", () => {
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(120)).toBe("2 hr");
  });

  it("keeps the remainder otherwise", () => {
    expect(formatDuration(90)).toBe("1 hr 30 min");
  });
});
