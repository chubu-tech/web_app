"use client";

import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { ProductCategoryStrip } from "@/components/customer/product-category-strip";
import { ProductGridCard } from "@/components/ui/product-card";
import { ProductSheet } from "@/components/customer/product-sheet";
import { useOrderCart } from "@/components/customer/use-order-cart";
import {
  applyProductFilter,
  productFilterIsActive,
  type ProductFilter,
} from "@/lib/product-filter";
import type { Product, ProductCategory } from "@/lib/types/salon";

/**
 * The cross-salon products grid — a port of `ProductsBrowse` in
 * `tho/app/lib/customer/shop/products_browse.dart`.
 *
 * **One page arrives from the server, already narrowed and sorted** (`browseProducts`), so this
 * component's job is the cart, the shelf strip, and one instant pass over the rows in hand.
 *
 * ## The client pass is a no-op on arrival, and that is the point
 *
 * The same arrangement the salon list on this page already documents: the server has applied the
 * search term, the price range and the sort across the whole catalogue, and the client applies
 * them again to the rows it is holding so that **typing narrows immediately** instead of waiting
 * for a round trip. On arrival that pass changes nothing — it is filtering an already-filtered
 * list by the same predicates. Between a keystroke and the navigation it lands on, it shows a
 * strict subset of what the server is about to return, which is the honest interim answer.
 *
 * What it is emphatically **not** is the filter. A filter over one page is not a filter and a
 * sort over one page sorts the wrong rows; both live in `browseProducts` now.
 *
 * ## Adding across salons
 *
 * `useOrderCart` owns that rule, the question it raises and the two guards around the quantity
 * control — see the note there. This file used to carry its own copy as a red toast, and so did
 * the salon shelf.
 *
 * ## Empty states say which kind of empty
 *
 * **Four** of them, and the distinction is the same one Discover draws: *nothing for sale
 * anywhere* is a claim about the marketplace and may only be made when nothing has been narrowed;
 * *no matches* is about the search term; *nothing in this shelf* is about the category and offers
 * to leave it; *nothing in this price range* is about the filter and offers to clear it. Collapsing
 * them would tell a customer the shop is empty when they had simply typed a typo.
 *
 * The order they are tested in is the order the customer narrowed: a typo inside a category is
 * reported as the typo, because that is the thing they can fix in one keystroke.
 *
 * **The marketplace claim is now derived from what was narrowed, not from a second read.** An
 * empty page used to mean an empty catalogue, because the catalogue *was* the page. With the
 * server narrowing, an empty result proves nothing about the marketplace unless nothing was
 * asked of it — so that is exactly the condition it is made under, and it costs no extra query.
 *
 * The category case is reachable in one way only — a shared or hand-edited `?cat=` for a shelf
 * that has since emptied — because the strip offers no unstocked shelf in the first place. It is
 * kept for exactly that arrival, and because a shelf can empty while somebody is looking at it.
 */
export function ProductsBrowse({
  products,
  categories,
  stockedCategoryIds,
  categorySlug,
  onSelectCategory,
  query,
  filter,
  onClearFilter,
  loadMoreHref,
}: {
  /** One page of the storefront, already narrowed and sorted by the server. */
  products: Product[];
  /** The platform taxonomy. Empty renders no strip and narrows nothing. */
  categories: ProductCategory[];
  /** Which of those have something buyable on them, measured across the whole catalogue. */
  stockedCategoryIds: string[];
  /** From `?cat=`. */
  categorySlug: string | null;
  onSelectCategory: (slug: string | null) => void;
  /** The shared search box's term — Discover owns it, and it serves both segments. */
  query: string;
  filter: ProductFilter;
  onClearFilter: () => void;
  /** One page deeper into the same run, or null at the end of it. */
  loadMoreHref: string | null;
}) {
  const { qtyOf, addProduct, setProductQty, dialog } = useOrderCart();
  const [open, setOpen] = useState<Product | null>(null);

  /*
    The slug is resolved against the loaded taxonomy rather than trusted. A hand-edited or
    stale `?cat=` then narrows **nothing** — the strip shows no selection and the grid shows
    everything — instead of matching no product and reporting an empty shelf that does not
    exist. Same rule `productFilterFromParams` applies to a stale price bound.
  */
  const category = categories.find((c) => c.slug === categorySlug) ?? null;

  /*
    **Only shelves that have something on them.**

    Upstream renders all eight, and has to: it pages the catalogue server-side and so cannot
    know which shelves are stocked without asking. This browse now pages too, so it asks —
    `fetchStockedCategoryIds`, one `distinct`-shaped read, rather than reading the answer off a
    catalogue held in the browser. That is what keeps the rule at any catalogue size, and the
    rule is not cosmetic: live today every product has a null `category_id`, so the strip would
    be eight doors onto eight empty rooms — a narrowing control whose every option narrows to
    nothing, which the customer can only discover by trying one.

    Measured across the **catalogue**, never the page and never `visible`: the shelves must not
    appear and disappear as somebody types in the search box or pages further in.

    The selected shelf is kept whatever its stock, so the tile a customer is standing on cannot
    vanish underneath them and strand them with no way back to everything.

    All of which self-heals: the moment an owner categorises one product, its shelf appears.
  */
  const shelves = useMemo(() => {
    const stocked = new Set(stockedCategoryIds);
    return categories.filter((c) => stocked.has(c.id) || c.slug === categorySlug);
  }, [categories, stockedCategoryIds, categorySlug]);

  const q = query.trim().toLowerCase();
  const matching = useMemo(() => {
    const byCategory =
      category == null ? products : products.filter((p) => p.categoryId === category.id);
    return q.length === 0
      ? byCategory
      : byCategory.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, q, category]);
  const visible = useMemo(() => applyProductFilter(filter, matching), [filter, matching]);

  /*
    The strip stays above every state below, empty ones included. It is how the customer got
    into a narrow shelf and it has to be how they get out — an empty state that replaces the
    control that caused it leaves the back button as the only way back.
  */
  const strip = (
    <ProductCategoryStrip
      categories={shelves}
      selectedSlug={category?.slug ?? null}
      onSelect={onSelectCategory}
    />
  );

  const filtered = productFilterIsActive(filter);
  const narrowed = q.length > 0 || category != null || filtered;

  // The only condition under which an empty result is a fact about the marketplace rather
  // than about what was asked of it.
  if (products.length === 0 && !narrowed) {
    return (
      <EmptyState
        icon={Icons.product}
        title="No products for sale yet"
        message="Salons on Growth and Pro can sell products for collection. When they list some, they show up here."
      />
    );
  }

  if (visible.length === 0) {
    // Narrowest cause first: a typo inside a shelf is still a typo.
    const cause = q.length > 0 ? "query" : category != null ? "category" : "filter";
    return (
      <>
        {strip}
        <div className="mt-lg">
          <EmptyState
            icon={cause === "query" ? Icons.searchEmpty : Icons.filterOff}
            title={
              cause === "query"
                ? "No matches"
                : cause === "category"
                  ? `Nothing in ${category!.name} yet`
                  : "Nothing in that price range"
            }
            message={
              cause === "query"
                ? `Nothing matches “${query.trim()}”.`
                : cause === "category"
                  ? "No salon has listed anything on this shelf. Try another, or browse everything."
                  : "Try widening the range, or clearing the filter."
            }
            action={
              cause === "category" ? (
                <Button variant="outlined" onClick={() => onSelectCategory(null)}>
                  Browse everything
                </Button>
              ) : filtered ? (
                <Button variant="outlined" onClick={onClearFilter}>
                  Clear filter
                </Button>
              ) : undefined
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      {strip}
      {/*
        One auto-fill track at every width, replacing `grid-cols-1 tablet:grid-cols-2
        wide:[360px]` — a table written for the old row card, whose 360px minimum put a
        single product per line on a phone.

        `min(45%, 10rem)` is the whole responsive rule, and both halves are load-bearing.
        **45%** is "never fewer than two columns", which is what a phone needs and what a
        fixed minimum cannot express. **10rem** caps it once there is room, and is tuned to
        reproduce upstream's column counts — its grid is a 220px max-extent, and this track
        lands on the same 4 / 5 / 7 columns at 744 / 1024 / 1440, with cards between 138
        and 193px everywhere in between. No breakpoints, which is upstream's rule too.

        `items-stretch` is the default and is relied on: it plus `h-full` inside the card is
        what makes every card in a row the same height, which is the job upstream needs a
        measured `mainAxisExtent` for.
      */}
      <ul className="gap-md mt-md grid grid-cols-[repeat(auto-fill,minmax(min(45%,10rem),1fr))]">
        {visible.map((product) => (
          <li key={product.id}>
            <ProductGridCard
              product={product}
              qty={qtyOf(product.id)}
              onAdd={() => addProduct(product)}
              onSetQty={(qty) => setProductQty(product, qty)}
              onOpen={() => setOpen(product)}
              // Matches the track above: never more than half the viewport on a phone,
              // never more than a 220px card once the cap is in force.
              sizes="(min-width: 744px) 220px, 50vw"
            />
          </li>
        ))}
      </ul>

      {/*
        One page more, as a link.

        A link and not a button because the browse is a server render: this is a navigation, it
        gets RSC prefetch on hover, and the URL it lands on is what is on screen — so the run a
        customer scrolled to is shareable and the back button steps back out of it. `scroll`
        stays off so pressing it reads as the grid growing rather than the page changing.

        It is the whole width and centred rather than tucked under the last card: at two columns
        on a phone a trailing control in the grid's flow is the thing most easily missed, and
        missing it looks exactly like the end of the catalogue.
      */}
      {loadMoreHref ? (
        <div className="mt-lg flex justify-center">
          <ButtonLink href={loadMoreHref} variant="outlined" scroll={false}>
            Load more
          </ButtonLink>
        </div>
      ) : null}

      <ProductSheet
        product={open}
        qty={open ? qtyOf(open.id) : 0}
        onSetQty={(qty) => open && setProductQty(open, qty)}
        onAdd={(n) => open && addProduct(open, n)}
        onClose={() => setOpen(null)}
      />
      {dialog}
    </>
  );
}
