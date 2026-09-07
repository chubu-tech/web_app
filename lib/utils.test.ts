import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cn, FONT_SIZE_TOKENS, formatDuration, formatNu, initials } from "./utils";

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

/*
  ## The guard that stops this bug coming back

  `cn` has to be told every font-size token by name, because `tailwind-merge` ships Tailwich's
  own scale and classifies anything else as a colour. A token added to the CSS and not added
  to `FONT_SIZE_TOKENS` is invisible — the class compiles, the build is clean, lint is clean,
  and the size is silently dropped at every call site that also passes a colour.

  So the list is checked against the stylesheets themselves rather than trusted. This is the
  only test in the suite that reads a CSS file, and that is the point: nothing else can catch
  the drift.
*/
describe("FONT_SIZE_TOKENS", () => {
  /** Every `--text-<name>:` declaration, ignoring the `--line-height` / `--letter-spacing` pairs. */
  function declaredIn(path: string): string[] {
    const css = readFileSync(new URL(path, import.meta.url), "utf-8");
    const found = new Set<string>();
    for (const [, name] of css.matchAll(/^\s*--text-([a-z0-9-]+)\s*:/gm)) {
      if (name!.includes("--")) continue;
      found.add(name!);
    }
    return [...found];
  }

  it("names every font-size token both stylesheets declare, and nothing else", () => {
    const declared = [
      ...declaredIn("../app/globals.css"),
      ...declaredIn("../app/marketing-tokens.css"),
    ];

    // Sorted rather than ordered: the constant is grouped by which system a token belongs to,
    // which is more use to a reader than alphabetical.
    expect([...FONT_SIZE_TOKENS].sort()).toEqual([...new Set(declared)].sort());
  });

  it("found a plausible number of them, so a broken regex cannot pass by matching nothing", () => {
    expect(FONT_SIZE_TOKENS.length).toBeGreaterThan(10);
  });
});

describe("cn", () => {
  it("keeps a size and a colour together — the bug this configuration fixes", () => {
    // Bare `twMerge` returned "font-medium text-muted" here, dropping the size entirely.
    expect(cn("text-title font-medium", "text-muted")).toContain("text-title");
    expect(cn("text-title font-medium", "text-muted")).toContain("text-muted");
  });

  it("keeps them together within a single class string too", () => {
    // It did not take two arguments to lose one: this returned just "text-muted-soft".
    const out = cn("text-caption text-muted-soft");
    expect(out).toContain("text-caption");
    expect(out).toContain("text-muted-soft");
  });

  it("still lets a later size win over an earlier one", () => {
    // The whole reason for using twMerge: an override has to override.
    expect(cn("text-body-sm", "text-title")).toBe("text-title");
    expect(cn("text-display-lg", "text-caption")).toBe("text-caption");
  });

  it("still lets a later colour win over an earlier one", () => {
    expect(cn("text-muted", "text-ink")).toBe("text-ink");
  });

  it("does not confuse the editorial scale with the product one", () => {
    // Both live in the same `text-*` namespace because `marketing-tokens.css` is imported
    // into the same stylesheet, so both had the same fault.
    expect(cn("text-editorial-lg", "text-ink")).toContain("text-editorial-lg");
    expect(cn("text-heading", "text-subheading")).toBe("text-subheading");
  });

  it("leaves Tailwind's own scale working", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    expect(cn("text-lg", "text-ink")).toContain("text-lg");
  });

  it("merges everything else as before", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("flex", null, undefined, false && "hidden", "items-center")).toBe(
      "flex items-center",
    );
  });
});
