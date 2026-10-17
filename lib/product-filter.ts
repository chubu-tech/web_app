import type { Product } from "./types/salon";

/**
 * Client-side sort and price-range filter over an already-loaded product list — a port of
 * `ProductFilter` in `tho/app/lib/customer/shop/product_filter.dart`.
 *
 * **The pipeline is name → price range → sort, all in the browser**, and the order matters: filter
 * before you sort, or the sort is doing work it throws away. The app puts the name match on the
 * server as an `ilike`; here it is local, because Discover already filters *salons* locally and one
 * search box serving two segments must behave the same in both. See `fetchProducts` for when that
 * stops being the right trade.
 *
 * **`null` means unconstrained, and is deliberately distinct from any specific bound.** A range
 * slider dragged back out to the loaded list's own extremes reads as *cleared*, not as "active with
 * a very wide range" — which is what keeps the filter badge honest. `priceBounds` is what a caller
 * compares against to decide that.
 *
 * State lives in the URL (`?sort=&min=&max=`), so a filtered browse is shareable — the same call
 * `lib/salon-filters.ts` made for salons.
 */

/**
 * One page of the storefront. 24, as `productPageSize` is upstream.
 *
 * Here rather than beside `browseProducts`, because the "Load more" link that grows a page is
 * built in a **client** component: importing it from `lib/api/shop.ts` would pull that whole
 * reader module — and `@supabase/supabase-js` behind it — into the browser bundle to read one
 * number.
 */
export const PRODUCT_PAGE_SIZE = 24;

/**
 * How far "Load more" can grow one URL: ten pages.
 *
 * The browse re-reads the whole run on each press rather than holding a cursor, which is what
 * keeps the page a plain server render and keeps the back button correct. That trade is only
 * honest while the run is short, so it is bounded here rather than left to whoever first pastes
 * a large number into the address bar. Live today the whole catalogue is three products; the cap
 * is what stops that from being an argument for having no cap.
 */
export const PRODUCT_MAX_TAKE = PRODUCT_PAGE_SIZE * 10;

/**
 * The page size a `?take=` asks for: a whole number of pages, at least one, at most ten.
 *
 * Anything unparseable, negative or fractional reads as the first page rather than as an error —
 * a hand-edited URL should narrow to something sensible, not 500.
 */
export function productTakeFromParam(raw: string | undefined | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < PRODUCT_PAGE_SIZE) return PRODUCT_PAGE_SIZE;
  const pages = Math.floor(n / PRODUCT_PAGE_SIZE);
  return Math.min(pages * PRODUCT_PAGE_SIZE, PRODUCT_MAX_TAKE);
}

export type ProductSort =
  | "featured"
  | "priceLowHigh"
  | "priceHighLow"
  | "newest"
  | "nameAZ"
  | "rating";

export const PRODUCT_SORTS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "priceLowHigh", label: "Price: Low to High" },
  { value: "priceHighLow", label: "Price: High to Low" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
  { value: "nameAZ", label: "Name A–Z" },
];

/**
 * The `order()` columns for a sort, most significant first — a port of
 * `Api._productSortColumns`.
 *
 * **Every sort ends on `id`, and that is the load-bearing part.** Without a unique
 * tiebreaker, rows that compare equal on the sort column — two products at Nu 300, two
 * sharing a `sort_order` — have no defined order between pages, so the same row can come
 * back on page 1 *and* page 2, or on neither. That is invisible with three products and
 * unmissable with three hundred, which is exactly the kind of bug a paginated read ships
 * with and nobody sees for a year.
 *
 * **`nullsFirst: false` is applied by the caller, to every column.** It only changes
 * anything for `rating_avg`, which is null for an unrated product and which Postgres puts
 * *first* on a descending order — so "Top rated" would open with every unrated product.
 * Applying it uniformly means a future nullable sort column cannot quietly inherit the
 * wrong default.
 */
export function productSortColumns(
  sort: ProductSort,
): { column: string; ascending: boolean }[] {
  const asc = (column: string) => ({ column, ascending: true });
  const desc = (column: string) => ({ column, ascending: false });
  switch (sort) {
    case "priceLowHigh":
      return [asc("price_nu"), asc("id")];
    case "priceHighLow":
      return [desc("price_nu"), asc("id")];
    case "newest":
      return [desc("created_at"), asc("id")];
    case "nameAZ":
      return [asc("name"), asc("id")];
    // Best first, then the better-evidenced of two equal averages.
    case "rating":
      return [desc("rating_avg"), desc("rating_count"), asc("id")];
    case "featured":
      return [asc("sort_order"), asc("name"), asc("id")];
  }
}

/**
 * A search term, safe to drop into a PostgREST `or=` expression.
 *
 * `or` is comma-delimited and parenthesis-wrapped, so a value containing either is parsed
 * as **structure** rather than as text — a search for `L'Oréal, 200ml` is otherwise read as
 * two separate filters and returns a query error instead of no results. Double-quoting tells
 * PostgREST to treat the whole thing as one literal; inner quotes and backslashes are escaped
 * so the quoting cannot be broken out of.
 *
 * **Not a security boundary.** RLS decides what is readable whatever this produces; this is a
 * query-shape correctness fix. Ported from `Api.escapeOrFilterValue`, with the same test cases.
 */
export function escapeOrFilterValue(term: string): string {
  return `"${term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export type ProductFilter = {
  sort: ProductSort;
  minNu: number | null;
  maxNu: number | null;
  /**
   * Brand ids to restrict to. Empty means unrestricted — an empty `in` list would match
   * nothing, which is the opposite of what an untouched facet means.
   */
  brandIds: string[];
  /**
   * A rating floor, 1–5, applied as `rating_avg >= minRating`.
   *
   * That **excludes unrated products entirely**, deliberately: a null average is not "at
   * least 4 stars", and a Top-rated shelf padded with unrated stock is a lie about itself.
   */
  minRating: number | null;
  /**
   * Restrict to genuine markdowns — `discount_pct > 0`, computed by the view from
   * `compare_at_nu > price_nu`. The same predicate a Deals rail uses, so the rail and the
   * listing behind its "See all" are one shelf rather than two that share a heading.
   */
  onSale: boolean;
};

export const EMPTY_PRODUCT_FILTER: ProductFilter = {
  sort: "featured",
  minNu: null,
  maxNu: null,
  brandIds: [],
  minRating: null,
  onSale: false,
};

/**
 * Price range first, then sort. Never mutates the input — the Dart has a test for that and so does
 * this, because `Array.prototype.sort` is in-place and the obvious implementation is wrong.
 *
 * `featured` leaves the loaded order alone, which is the server's `created_at desc` — newest first.
 * That is why it is the default: it is the only ordering the customer did not ask for.
 */
export function applyProductFilter(filter: ProductFilter, products: Product[]): Product[] {
  const result = products.filter((p) => {
    if (filter.minNu != null && p.priceNu < filter.minNu) return false;
    if (filter.maxNu != null && p.priceNu > filter.maxNu) return false;
    return true;
  });

  switch (filter.sort) {
    case "priceLowHigh":
      result.sort((a, b) => a.priceNu - b.priceNu);
      break;
    case "priceHighLow":
      result.sort((a, b) => b.priceNu - a.priceNu);
      break;
    case "nameAZ":
      result.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      break;
    /*
      The two sorts the server does properly, mirrored here so a caller holding a small
      list in hand does not get a silent no-op. `createdAt` is null on a hand-built product
      and `ratingAvg` is null on an unrated one; both sort **last**, which is what
      `nullsFirst: false` does on the server side of the same two orderings.
    */
    case "newest":
      result.sort((a, b) => (b.createdAt?.getTime() ?? -1) - (a.createdAt?.getTime() ?? -1));
      break;
    case "rating":
      result.sort(
        (a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) || b.ratingCount - a.ratingCount,
      );
      break;
    case "featured":
      break;
  }
  return result;
}

/** True when any facet deviates from its default — drives the filter button's badge. */
export function productFilterIsActive(filter: ProductFilter): boolean {
  return productFilterCount(filter) > 0;
}

/**
 * How many facets are active: sort counts as one, the price range as one however wide, the
 * brand list as one however many, and the rating floor and the sale switch one each.
 */
export function productFilterCount(filter: ProductFilter): number {
  return (
    (filter.sort !== "featured" ? 1 : 0) +
    (filter.minNu != null || filter.maxNu != null ? 1 : 0) +
    (filter.brandIds.length > 0 ? 1 : 0) +
    (filter.minRating != null ? 1 : 0) +
    (filter.onSale ? 1 : 0)
  );
}

/**
 * The cheapest and dearest of the loaded list — the bounds the range control spans.
 *
 * **The paged browse uses `productPriceBounds` instead**, and must: page one is not the
 * catalogue, so bounds taken from it would be wrong and would silently widen as the customer
 * pressed "Load more". This is the in-hand form, for a list that is genuinely all of itself —
 * a single salon's shelf — and it is the shape `productPriceBounds` returns for an empty scope.
 *
 * Both 0 for an empty list, and equal when every product costs the same, which the sheet has to
 * handle: a slider whose min equals its max cannot be dragged, so it says "All products are Nu N"
 * instead of pretending to offer a range.
 */
export function priceBounds(products: Product[]): { lowest: number; highest: number } {
  if (products.length === 0) return { lowest: 0, highest: 0 };
  let lowest = products[0]!.priceNu;
  let highest = lowest;
  for (const p of products) {
    if (p.priceNu < lowest) lowest = p.priceNu;
    if (p.priceNu > highest) highest = p.priceNu;
  }
  return { lowest, highest };
}

/**
 * Read a filter out of the URL.
 *
 * A bound is kept only when it actually narrows the loaded list — the same rule the Dart sheet
 * applies on Apply, moved here so a hand-edited or stale URL cannot produce a filter that claims to
 * be active while matching everything. Pass no bounds when the list isn't loaded yet; the values
 * survive and are re-checked once it is.
 */
export function productFilterFromParams(
  params: {
    sort?: string;
    min?: string;
    max?: string;
    brands?: string;
    rating?: string;
    sale?: string;
  },
  bounds?: { lowest: number; highest: number },
): ProductFilter {
  const sort = PRODUCT_SORTS.some((s) => s.value === params.sort)
    ? (params.sort as ProductSort)
    : "featured";

  const rating = toInt(params.rating);
  const rest = {
    // Comma-separated, empties dropped, so `?brands=` and `?brands=,,` both mean
    // unrestricted rather than "match nothing".
    brandIds: (params.brands ?? "").split(",").filter(Boolean),
    // Only a whole star between 1 and 5, so a hand-edited URL cannot invent a floor the
    // sheet has no way to display or to clear.
    minRating: rating != null && rating >= 1 && rating <= 5 ? rating : null,
    onSale: params.sale === "1",
  };

  const min = toInt(params.min);
  const max = toInt(params.max);
  if (!bounds) return { sort, minNu: min, maxNu: max, ...rest };

  const narrows =
    bounds.highest > bounds.lowest &&
    ((min != null && min > bounds.lowest) || (max != null && max < bounds.highest));
  return narrows
    ? { sort, minNu: min, maxNu: max, ...rest }
    : { sort, minNu: null, maxNu: null, ...rest };
}

/** The inverse, for building a link. Defaults are omitted so a clean view has a clean URL. */
export function productFilterToParams(filter: ProductFilter): Record<string, string> {
  const out: Record<string, string> = {};
  if (filter.sort !== "featured") out.sort = filter.sort;
  if (filter.minNu != null) out.min = String(filter.minNu);
  if (filter.maxNu != null) out.max = String(filter.maxNu);
  if (filter.brandIds.length > 0) out.brands = filter.brandIds.join(",");
  if (filter.minRating != null) out.rating = String(filter.minRating);
  if (filter.onSale) out.sale = "1";
  return out;
}

function toInt(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
