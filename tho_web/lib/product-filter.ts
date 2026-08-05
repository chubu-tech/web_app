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

export type ProductSort = "featured" | "priceLowHigh" | "priceHighLow" | "nameAZ";

export const PRODUCT_SORTS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "priceLowHigh", label: "Price: Low to High" },
  { value: "priceHighLow", label: "Price: High to Low" },
  { value: "nameAZ", label: "Name A–Z" },
];

export type ProductFilter = {
  sort: ProductSort;
  minNu: number | null;
  maxNu: number | null;
};

export const EMPTY_PRODUCT_FILTER: ProductFilter = {
  sort: "featured",
  minNu: null,
  maxNu: null,
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
    case "featured":
      break;
  }
  return result;
}

/** True when any facet deviates from its default — drives the filter button's badge. */
export function productFilterIsActive(filter: ProductFilter): boolean {
  return filter.sort !== "featured" || filter.minNu != null || filter.maxNu != null;
}

/** How many facets are active: sort counts as one, the price range as one however wide. */
export function productFilterCount(filter: ProductFilter): number {
  return (
    (filter.sort !== "featured" ? 1 : 0) +
    (filter.minNu != null || filter.maxNu != null ? 1 : 0)
  );
}

/**
 * The cheapest and dearest of the loaded list — the bounds the range control spans.
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
  params: { sort?: string; min?: string; max?: string },
  bounds?: { lowest: number; highest: number },
): ProductFilter {
  const sort = PRODUCT_SORTS.some((s) => s.value === params.sort)
    ? (params.sort as ProductSort)
    : "featured";

  const min = toInt(params.min);
  const max = toInt(params.max);
  if (!bounds) return { sort, minNu: min, maxNu: max };

  const narrows =
    bounds.highest > bounds.lowest &&
    ((min != null && min > bounds.lowest) || (max != null && max < bounds.highest));
  return narrows ? { sort, minNu: min, maxNu: max } : { sort, minNu: null, maxNu: null };
}

/** The inverse, for building a link. Defaults are omitted so a clean view has a clean URL. */
export function productFilterToParams(filter: ProductFilter): Record<string, string> {
  const out: Record<string, string> = {};
  if (filter.sort !== "featured") out.sort = filter.sort;
  if (filter.minNu != null) out.min = String(filter.minNu);
  if (filter.maxNu != null) out.max = String(filter.maxNu);
  return out;
}

function toInt(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
