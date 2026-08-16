import { describe, expect, it } from "vitest";
import { searchFilter } from "./discovery";

/**
 * `searchFilter` builds a PostgREST `or` argument from visitor-supplied text, so its
 * whole job is to be safe against input nobody sanitised. The comma case is the one that
 * matters: PostgREST splits that argument on commas, so a comma inside the pattern ends
 * one filter early and the remainder is parsed as another.
 */
describe("searchFilter", () => {
  it("matches name or address, anywhere in the field", () => {
    // Not a prefix match — "lam" has to find "Norzin Lam".
    expect(searchFilter("lam")).toBe("name.ilike.%lam%,address_text.ilike.%lam%");
  });

  it("returns null for a blank term so the list is not filtered to nothing", () => {
    expect(searchFilter("")).toBeNull();
    expect(searchFilter("   ")).toBeNull();
    expect(searchFilter("%%%")).toBeNull();
    expect(searchFilter(",,,")).toBeNull();
  });

  it("strips the comma that would end the filter early", () => {
    const out = searchFilter("Norzin, Thimphu")!;
    // One comma only: the separator this function itself puts between the two clauses.
    expect(out.split(",")).toHaveLength(2);
    expect(out).toContain("Norzin Thimphu");
  });

  it("strips the ilike wildcard, which would otherwise match everything", () => {
    expect(searchFilter("%")).toBeNull();
    expect(searchFilter("Nor%zin")).toBe(
      "name.ilike.%Nor zin%,address_text.ilike.%Nor zin%",
    );
  });

  it("strips parentheses, which delimit a PostgREST value list", () => {
    const out = searchFilter("Kira (Nails)")!;
    expect(out).not.toContain("(");
    expect(out).not.toContain(")");
  });

  it("collapses whitespace so a stripped character does not leave a double space", () => {
    expect(searchFilter("  Norzin   Salon  ")).toBe(
      "name.ilike.%Norzin Salon%,address_text.ilike.%Norzin Salon%",
    );
  });

  it("keeps the ampersand, which is in two live salon names", () => {
    // `Norzin Salon & Spa` and `Kira Nails & Beauty` — an over-eager strip would make
    // both unsearchable by their own names.
    expect(searchFilter("Nails & Beauty")).toContain("Nails & Beauty");
  });
});
