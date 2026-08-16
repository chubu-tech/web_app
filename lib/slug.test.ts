import { describe, expect, it } from "vitest";
import {
  isCanonicalParam,
  parseEntityId,
  salonPath,
  slugifyName,
  stylistPath,
} from "./slug";

/** The live seed ids, so the cases are the shapes the app actually serves. */
const NORZIN = "0b000000-0000-4000-8000-000000000001";
const CLOCK_TOWER = "0b000000-0000-4000-8000-000000000009";

describe("slugifyName", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyName("Norzin Salon")).toBe("norzin-salon");
  });

  it("spells out an ampersand rather than dropping it", () => {
    // "Norzin Salon & Spa" must not become "norzin-salon-spa" by silently deleting the
    // word — two live salons differ only by what surrounds theirs.
    expect(slugifyName("Norzin Salon & Spa")).toBe("norzin-salon-and-spa");
  });

  it("strips diacritics to their base letter rather than deleting the character", () => {
    expect(slugifyName("Café Coiffure")).toBe("cafe-coiffure");
  });

  it("collapses runs of punctuation and trims the edges", () => {
    expect(slugifyName("  --Kira's Nails & Beauty!!  ")).toBe(
      "kira-s-nails-and-beauty",
    );
  });

  it("returns an empty string for a name with no Latin characters", () => {
    // The live data is bilingual; this is the case `salonPath` falls back on.
    expect(slugifyName("ཐིམ་ཕུ")).toBe("");
  });

  it("never ends in a hyphen after truncation", () => {
    const long = `${"a".repeat(59)} tail`;
    const slug = slugifyName(long);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(60);
  });
});

describe("salonPath / stylistPath", () => {
  it("puts the name in front of the id", () => {
    expect(salonPath({ id: NORZIN, name: "Norzin Salon & Spa" })).toBe(
      `/salon/norzin-salon-and-spa-${NORZIN}`,
    );
  });

  it("round-trips: every minted path parses back to the id it was minted from", () => {
    // The property the whole scheme rests on. A link this app generates must be a link
    // this app can read.
    for (const name of [
      "Norzin Salon & Spa",
      "Kira's Nails & Beauty",
      "Café Coiffure",
      "ཐིམ་ཕུ",
      "",
      "----",
      "A".repeat(200),
    ]) {
      const path = salonPath({ id: NORZIN, name });
      const param = path.slice(path.lastIndexOf("/") + 1);
      expect(parseEntityId(param), `name: ${JSON.stringify(name)}`).toBe(NORZIN);
    }
  });

  it("omits the slug for an id that is not UUID-shaped, so mint stays invertible", () => {
    // `parseEntityId` finds a UUID at the end of the segment; appending a slug to any
    // other id shape would mint a URL this app cannot read back.
    expect(salonPath({ id: "b1", name: "Norzin Salon & Spa" })).toBe("/salon/b1");
  });

  it("falls back to the bare id when the name slugifies to nothing", () => {
    // `/salon/-<uuid>` would be the alternative, and a leading hyphen is worse than
    // no slug at all.
    expect(salonPath({ id: NORZIN, name: "ཐིམ་ཕུ" })).toBe(`/salon/${NORZIN}`);
    expect(salonPath({ id: NORZIN, name: null })).toBe(`/salon/${NORZIN}`);
  });

  it("slugs a stylist by display name", () => {
    expect(stylistPath({ id: CLOCK_TOWER, displayName: "Sonam Dorji" })).toBe(
      `/stylist/sonam-dorji-${CLOCK_TOWER}`,
    );
  });
});

describe("parseEntityId", () => {
  it("reads a bare id", () => {
    expect(parseEntityId(NORZIN)).toBe(NORZIN);
  });

  it("reads the id out of a slugged param", () => {
    expect(parseEntityId(`norzin-salon-and-spa-${NORZIN}`)).toBe(NORZIN);
  });

  it("is anchored, so a slug that merely contains an id-shaped run does not match", () => {
    expect(parseEntityId(`${NORZIN}-trailing-words`)).toBeNull();
  });

  it("survives a rename, because the id is the key", () => {
    // The whole reason the slug is derived rather than stored: an old link keeps working.
    expect(parseEntityId(`the-old-name-${NORZIN}`)).toBe(NORZIN);
  });

  it("returns null for anything that cannot be an id", () => {
    expect(parseEntityId("norzin-salon")).toBeNull();
    expect(parseEntityId("")).toBeNull();
    expect(parseEntityId("../../etc/passwd")).toBeNull();
  });

  it("normalises case, because a UUID is hex and both cases resolve", () => {
    expect(parseEntityId(NORZIN.toUpperCase())).toBe(NORZIN);
  });

  it("does not throw on a malformed percent escape", () => {
    // A crawler will eventually fetch one of these; a 500 is a worse answer than a 404.
    expect(() => parseEntityId("%E0%A4%A")).not.toThrow();
    expect(parseEntityId("%E0%A4%A")).toBeNull();
  });
});

describe("isCanonicalParam", () => {
  const canonical = `/salon/norzin-salon-and-spa-${NORZIN}`;

  it("accepts the minted form", () => {
    expect(isCanonicalParam(`norzin-salon-and-spa-${NORZIN}`, canonical)).toBe(true);
  });

  it("rejects a bare id, which is what triggers the redirect", () => {
    expect(isCanonicalParam(NORZIN, canonical)).toBe(false);
  });

  it("rejects a stale slug from before a rename", () => {
    expect(isCanonicalParam(`the-old-name-${NORZIN}`, canonical)).toBe(false);
  });

  it("treats a differently-cased id as canonical rather than redirect-looping", () => {
    // Both resolve to the same row, so a redirect here would be a redirect to itself.
    expect(
      isCanonicalParam(`norzin-salon-and-spa-${NORZIN.toUpperCase()}`, canonical),
    ).toBe(true);
  });
});
