import { describe, expect, it } from "vitest";
import {
  applyProductFilter,
  EMPTY_PRODUCT_FILTER,
  priceBounds,
  productFilterCount,
  productFilterFromParams,
  productFilterIsActive,
  productFilterToParams,
  type ProductFilter,
} from "./product-filter";
import type { Product } from "./types/salon";

/**
 * Every case of `../tho/app/test/product_filter_test.dart`, with the same four products and the same
 * expected orderings, plus the URL round trip the web adds.
 */

function product(id: string, name: string, priceNu: number): Product {
  return {
    id,
    businessId: "biz-1",
    name,
    priceNu,
    description: null,
    photoUrl: null,
    inStock: true,
    isArchived: false,
    sortOrder: 0,
    businessName: null,
  };
}

const products = [
  product("p1", "Zinc Shampoo", 300),
  product("p2", "Argan Oil", 500),
  product("p3", "Bamboo Comb", 100),
  product("p4", "Curl Cream", 400),
];

const filter = (over: Partial<ProductFilter> = {}): ProductFilter => ({
  ...EMPTY_PRODUCT_FILTER,
  ...over,
});

const ids = (list: Product[]) => list.map((p) => p.id);

// ===================================================================== sort =====

describe("applyProductFilter — sort", () => {
  it("Featured (the default) leaves the loaded order unchanged", () => {
    expect(ids(applyProductFilter(filter(), products))).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("Price: Low to High orders ascending", () => {
    const out = applyProductFilter(filter({ sort: "priceLowHigh" }), products);
    expect(ids(out)).toEqual(["p3", "p1", "p4", "p2"]);
    expect(out.map((p) => p.priceNu)).toEqual([100, 300, 400, 500]);
  });

  it("Price: High to Low orders descending", () => {
    const out = applyProductFilter(filter({ sort: "priceHighLow" }), products);
    expect(ids(out)).toEqual(["p2", "p4", "p1", "p3"]);
    expect(out.map((p) => p.priceNu)).toEqual([500, 400, 300, 100]);
  });

  it("Name A–Z orders case-insensitively", () => {
    const out = applyProductFilter(filter({ sort: "nameAZ" }), products);
    expect(out.map((p) => p.name)).toEqual([
      "Argan Oil",
      "Bamboo Comb",
      "Curl Cream",
      "Zinc Shampoo",
    ]);
  });
});

// ============================================================== price range =====

describe("applyProductFilter — price range", () => {
  it("excludes products below minNu", () => {
    expect(new Set(ids(applyProductFilter(filter({ minNu: 350 }), products)))).toEqual(
      new Set(["p2", "p4"]),
    );
  });

  it("excludes products above maxNu", () => {
    expect(new Set(ids(applyProductFilter(filter({ maxNu: 300 }), products)))).toEqual(
      new Set(["p1", "p3"]),
    );
  });

  it("bounds both ends inclusively", () => {
    expect(
      new Set(ids(applyProductFilter(filter({ minNu: 300, maxNu: 400 }), products))),
    ).toEqual(new Set(["p1", "p4"]));
  });

  it("filters first, then orders — the pipeline the module documents", () => {
    const out = applyProductFilter(filter({ minNu: 300, sort: "priceLowHigh" }), products);
    expect(ids(out)).toEqual(["p1", "p4", "p2"]);
  });

  it("does not mutate the input list", () => {
    // `Array.prototype.sort` is in place, so the obvious implementation gets this wrong.
    const before = ids(products);
    applyProductFilter(filter({ sort: "priceHighLow", minNu: 200 }), products);
    expect(ids(products)).toEqual(before);
  });
});

// ================================================== isActive / activeCount =====

describe("productFilterIsActive / productFilterCount", () => {
  it("the default is inactive with a zero count", () => {
    expect(productFilterIsActive(filter())).toBe(false);
    expect(productFilterCount(filter())).toBe(0);
  });

  it("a non-featured sort alone is one facet", () => {
    expect(productFilterIsActive(filter({ sort: "nameAZ" }))).toBe(true);
    expect(productFilterCount(filter({ sort: "nameAZ" }))).toBe(1);
  });

  it("a price range alone is one facet, however wide", () => {
    expect(productFilterIsActive(filter({ minNu: 100 }))).toBe(true);
    expect(productFilterCount(filter({ minNu: 100 }))).toBe(1);
    expect(productFilterCount(filter({ minNu: 100, maxNu: 400 }))).toBe(1);
  });

  it("sort and price range together are two", () => {
    const f = filter({ sort: "priceLowHigh", minNu: 100, maxNu: 400 });
    expect(productFilterIsActive(f)).toBe(true);
    expect(productFilterCount(f)).toBe(2);
  });
});

// ================================================================= bounds ======

describe("priceBounds", () => {
  it("finds the cheapest and dearest", () => {
    expect(priceBounds(products)).toEqual({ lowest: 100, highest: 500 });
  });

  it("is zero for an empty list", () => {
    expect(priceBounds([])).toEqual({ lowest: 0, highest: 0 });
  });

  it("returns equal bounds when everything costs the same — the sheet has to handle it", () => {
    expect(priceBounds([product("a", "A", 250), product("b", "B", 250)])).toEqual({
      lowest: 250,
      highest: 250,
    });
  });

  it("matches the live catalogue's buyable three", () => {
    // Norzin sells at 450, 320, 280 in stock (890 is sold out and never reaches a customer).
    expect(
      priceBounds([product("a", "A", 450), product("b", "B", 320), product("c", "C", 280)]),
    ).toEqual({ lowest: 280, highest: 450 });
  });
});

// ================================================================ the URL ======

describe("productFilterFromParams / productFilterToParams", () => {
  it("round-trips a filter", () => {
    const f = filter({ sort: "priceHighLow", minNu: 300, maxNu: 400 });
    const params = productFilterToParams(f);
    expect(params).toEqual({ sort: "priceHighLow", min: "300", max: "400" });
    expect(productFilterFromParams(params)).toEqual(f);
  });

  it("omits defaults, so a clean view has a clean URL", () => {
    expect(productFilterToParams(EMPTY_PRODUCT_FILTER)).toEqual({});
  });

  it("falls back to Featured for a sort it does not know", () => {
    expect(productFilterFromParams({ sort: "cheapest" }).sort).toBe("featured");
    expect(productFilterFromParams({}).sort).toBe("featured");
  });

  it("ignores a bound that is not a non-negative integer", () => {
    expect(productFilterFromParams({ min: "abc" }).minNu).toBeNull();
    expect(productFilterFromParams({ min: "-5" }).minNu).toBeNull();
    expect(productFilterFromParams({ min: "" }).minNu).toBeNull();
    expect(productFilterFromParams({ min: "300" }).minNu).toBe(300);
  });

  it("drops a range that does not actually narrow the loaded list", () => {
    // The rule the Dart sheet applies on Apply, moved here so a stale or hand-edited URL cannot
    // claim to be filtering while matching everything.
    const bounds = { lowest: 100, highest: 500 };
    const spanning = productFilterFromParams({ min: "100", max: "500" }, bounds);
    expect(spanning.minNu).toBeNull();
    expect(spanning.maxNu).toBeNull();
    expect(productFilterIsActive(spanning)).toBe(false);

    const narrowed = productFilterFromParams({ min: "200", max: "500" }, bounds);
    expect(narrowed.minNu).toBe(200);
    expect(productFilterIsActive(narrowed)).toBe(true);
  });

  it("drops any range when every product costs the same", () => {
    // There is no range to narrow, so a bound would be meaningless.
    const f = productFilterFromParams({ min: "250", max: "250" }, { lowest: 250, highest: 250 });
    expect(f.minNu).toBeNull();
    expect(f.maxNu).toBeNull();
  });

  it("keeps the sort even when the range is dropped", () => {
    const f = productFilterFromParams(
      { sort: "nameAZ", min: "100", max: "500" },
      { lowest: 100, highest: 500 },
    );
    expect(f.sort).toBe("nameAZ");
    expect(productFilterCount(f)).toBe(1);
  });
});
