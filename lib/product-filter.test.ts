import { describe, expect, it } from "vitest";
import {
  applyProductFilter,
  EMPTY_PRODUCT_FILTER,
  escapeOrFilterValue,
  priceBounds,
  PRODUCT_MAX_TAKE,
  PRODUCT_PAGE_SIZE,
  PRODUCT_SORTS,
  productFilterCount,
  productFilterFromParams,
  productFilterIsActive,
  productFilterToParams,
  productSortColumns,
  productTakeFromParam,
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
    brandId: null,
    brandName: null,
    categoryId: null,
    categoryName: null,
    tags: [],
    hairTypes: [],
    concerns: [],
    volume: null,
    ingredients: null,
    howToUse: null,
    compareAtNu: null,
    discountPct: null,
    ratingAvg: null,
    ratingCount: 0,
    trendingViews: 0,
    createdAt: null,
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

// ========================================================== server ordering =====

/**
 * `productSortColumns` is the sort that actually runs — `applyProductFilter` only re-applies it
 * to the page in hand. These are the properties that stop a *paged* browse from lying.
 */
describe("productSortColumns", () => {
  it("ends every sort on a unique column", () => {
    for (const { value } of PRODUCT_SORTS) {
      const columns = productSortColumns(value);
      expect(columns.at(-1)).toEqual({ column: "id", ascending: true });
    }
  });

  /**
   * The reason for the rule above, stated as its own case so removing the tiebreaker fails
   * here with the explanation attached: rows that compare equal on the sort column have no
   * defined order between pages, so one of them can come back on page 1 *and* page 2, or on
   * neither. Invisible at three products, unmissable at three hundred.
   */
  it("never sorts on a column that can tie without a tiebreaker after it", () => {
    for (const { value } of PRODUCT_SORTS) {
      const columns = productSortColumns(value);
      expect(columns.length).toBeGreaterThan(1);
    }
  });

  it("orders featured by the owner's own shelf order first", () => {
    expect(productSortColumns("featured")).toEqual([
      { column: "sort_order", ascending: true },
      { column: "name", ascending: true },
      { column: "id", ascending: true },
    ]);
  });

  it("breaks equal ratings on the better-evidenced one", () => {
    expect(productSortColumns("rating")).toEqual([
      { column: "rating_avg", ascending: false },
      { column: "rating_count", ascending: false },
      { column: "id", ascending: true },
    ]);
  });

  it("reads newest as newest first", () => {
    expect(productSortColumns("newest")[0]).toEqual({
      column: "created_at",
      ascending: false,
    });
  });

  it("points the two price sorts in opposite directions", () => {
    expect(productSortColumns("priceLowHigh")[0]).toEqual({
      column: "price_nu",
      ascending: true,
    });
    expect(productSortColumns("priceHighLow")[0]).toEqual({
      column: "price_nu",
      ascending: false,
    });
  });
});

// ============================================================ or= escaping =====

/**
 * The cases from `Api.escapeOrFilterValue`. A PostgREST `or=` expression is comma-delimited and
 * parenthesis-wrapped, so an unescaped term is parsed as **structure** rather than as text.
 */
describe("escapeOrFilterValue", () => {
  it("wraps a plain term in quotes", () => {
    expect(escapeOrFilterValue("%shampoo%")).toBe('"%shampoo%"');
  });

  it("keeps a comma inside one literal, which is the whole point", () => {
    // Unescaped, `L'Or\u00e9al, 200ml` reads as two filters and the query errors.
    expect(escapeOrFilterValue("%oil, 200ml%")).toBe('"%oil, 200ml%"');
  });

  it("escapes a quote so the quoting cannot be broken out of", () => {
    expect(escapeOrFilterValue('a"b')).toBe('"a\\"b"');
  });

  it("escapes a backslash before it can escape anything else", () => {
    expect(escapeOrFilterValue("a\\b")).toBe('"a\\\\b"');
  });

  it("handles a backslash immediately before a quote", () => {
    expect(escapeOrFilterValue('a\\"b')).toBe('"a\\\\\\"b"');
  });
});

// ================================================================== paging =====

describe("productTakeFromParam", () => {
  it("defaults to one page", () => {
    expect(productTakeFromParam(undefined)).toBe(PRODUCT_PAGE_SIZE);
    expect(productTakeFromParam(null)).toBe(PRODUCT_PAGE_SIZE);
    expect(productTakeFromParam("")).toBe(PRODUCT_PAGE_SIZE);
  });

  it("reads a hand-edited URL down to something sensible rather than erroring", () => {
    expect(productTakeFromParam("nonsense")).toBe(PRODUCT_PAGE_SIZE);
    expect(productTakeFromParam("-40")).toBe(PRODUCT_PAGE_SIZE);
    expect(productTakeFromParam("0")).toBe(PRODUCT_PAGE_SIZE);
  });

  it("rounds down to a whole number of pages", () => {
    expect(productTakeFromParam(String(PRODUCT_PAGE_SIZE * 2))).toBe(PRODUCT_PAGE_SIZE * 2);
    expect(productTakeFromParam(String(PRODUCT_PAGE_SIZE * 2 + 5))).toBe(
      PRODUCT_PAGE_SIZE * 2,
    );
  });

  /** The cap is what stops a pasted number from turning one navigation into a table scan. */
  it("caps the run at ten pages", () => {
    expect(productTakeFromParam("100000")).toBe(PRODUCT_MAX_TAKE);
  });
});

// ================================================= the three widened facets =====

describe("the brand, rating and sale facets", () => {
  it("counts each of them as one", () => {
    expect(productFilterCount(filter({ brandIds: ["b1", "b2"] }))).toBe(1);
    expect(productFilterCount(filter({ minRating: 4 }))).toBe(1);
    expect(productFilterCount(filter({ onSale: true }))).toBe(1);
    expect(
      productFilterCount(
        filter({ sort: "rating", minNu: 100, brandIds: ["b1"], minRating: 4, onSale: true }),
      ),
    ).toBe(5);
  });

  it("round-trips through the URL", () => {
    const f = filter({ brandIds: ["b1", "b2"], minRating: 4, onSale: true, sort: "newest" });
    const params = productFilterToParams(f);
    expect(params).toEqual({ sort: "newest", brands: "b1,b2", rating: "4", sale: "1" });
    expect(productFilterFromParams(params)).toEqual(f);
  });

  /** An empty `in` list matches nothing, which is the opposite of an untouched facet. */
  it("reads an empty or ragged brands parameter as unrestricted", () => {
    expect(productFilterFromParams({ brands: "" }).brandIds).toEqual([]);
    expect(productFilterFromParams({ brands: ",," }).brandIds).toEqual([]);
    expect(productFilterFromParams({ brands: "b1,,b2" }).brandIds).toEqual(["b1", "b2"]);
  });

  /**
   * A hand-edited URL must not invent a floor the sheet has no way to display or to clear —
   * and there is no such thing as a zero-star or six-star rating.
   */
  it("ignores a rating outside one to five", () => {
    expect(productFilterFromParams({ rating: "0" }).minRating).toBeNull();
    expect(productFilterFromParams({ rating: "6" }).minRating).toBeNull();
    expect(productFilterFromParams({ rating: "x" }).minRating).toBeNull();
    expect(productFilterFromParams({ rating: "1" }).minRating).toBe(1);
    expect(productFilterFromParams({ rating: "5" }).minRating).toBe(5);
  });

  it("treats anything but 1 as not on sale", () => {
    expect(productFilterFromParams({ sale: "1" }).onSale).toBe(true);
    expect(productFilterFromParams({ sale: "true" }).onSale).toBe(false);
    expect(productFilterFromParams({}).onSale).toBe(false);
  });

  /**
   * The price bounds are reconciled against the catalogue and the other three are not, because
   * only price has a "spans everything, so it narrows nothing" state. Dropping a shelf's brands
   * because the price range was wide would be a facet clearing a different facet.
   */
  it("keeps the other facets when a price bound is discarded as too wide", () => {
    const out = productFilterFromParams(
      { min: "100", max: "500", brands: "b1", rating: "4", sale: "1" },
      { lowest: 100, highest: 500 },
    );
    expect(out.minNu).toBeNull();
    expect(out.maxNu).toBeNull();
    expect(out.brandIds).toEqual(["b1"]);
    expect(out.minRating).toBe(4);
    expect(out.onSale).toBe(true);
  });
});

// ============================================== the two sorts the page adds =====

describe("applyProductFilter — the newest and rating sorts", () => {
  const dated = (id: string, at: Date | null, avg: number | null, count: number): Product => ({
    ...product(id, id.toUpperCase(), 100),
    createdAt: at,
    ratingAvg: avg,
    ratingCount: count,
  });

  it("puts the newest first and an undated product last", () => {
    const out = applyProductFilter(filter({ sort: "newest" }), [
      dated("a", new Date("2026-01-01T00:00:00Z"), null, 0),
      dated("b", null, null, 0),
      dated("c", new Date("2026-06-01T00:00:00Z"), null, 0),
    ]);
    expect(ids(out)).toEqual(["c", "a", "b"]);
  });

  /**
   * The one place `nullsFirst: false` earns its keep on the server: Postgres puts nulls
   * *first* on a descending order, so "Top rated" would otherwise open with every product
   * nobody has rated. The client mirror has to agree, or the page and its next page disagree.
   */
  it("puts an unrated product last, not first", () => {
    const out = applyProductFilter(filter({ sort: "rating" }), [
      dated("a", null, null, 0),
      dated("b", null, 4.5, 2),
      dated("c", null, 3.0, 9),
    ]);
    expect(ids(out)).toEqual(["b", "c", "a"]);
  });

  it("breaks an equal average on the number of reviews behind it", () => {
    const out = applyProductFilter(filter({ sort: "rating" }), [
      dated("a", null, 4.5, 2),
      dated("b", null, 4.5, 30),
    ]);
    expect(ids(out)).toEqual(["b", "a"]);
  });
});
