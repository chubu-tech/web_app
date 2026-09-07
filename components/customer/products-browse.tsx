"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { ProductGridCard } from "@/components/ui/product-card";
import { ProductSheet } from "@/components/customer/product-sheet";
import { useOrderCart } from "@/components/customer/use-order-cart";
import {
  applyProductFilter,
  productFilterIsActive,
  type ProductFilter,
} from "@/lib/product-filter";
import type { Product } from "@/lib/types/salon";

/**
 * The cross-salon products grid — a port of `ProductsBrowse` in
 * `tho/app/lib/customer/shop/products_browse.dart`.
 *
 * The catalogue arrives from the server (`fetchProducts`), so this component's job is the three
 * things that need a browser: the name match, the filter, and the cart.
 *
 * ## Adding across salons
 *
 * `useOrderCart` owns that rule, the question it raises and the two guards around the quantity
 * control — see the note there. This file used to carry its own copy as a red toast, and so did
 * the salon shelf.
 *
 * ## Empty states say which kind of empty
 *
 * Three of them, and the distinction is the same one Discover draws: *nothing for sale anywhere* is a
 * claim about the marketplace and may only be made when nothing has been narrowed; *no matches* is
 * about the search term; *nothing in this price range* is about the filter and offers to clear it.
 * Collapsing them would tell a customer the shop is empty when they had simply typed a typo.
 */
export function ProductsBrowse({
  products,
  query,
  filter,
  onClearFilter,
}: {
  products: Product[];
  /** The shared search box's term — Discover owns it, and it serves both segments. */
  query: string;
  filter: ProductFilter;
  onClearFilter: () => void;
}) {
  const { qtyOf, addProduct, setProductQty, dialog } = useOrderCart();
  const [open, setOpen] = useState<Product | null>(null);

  const q = query.trim().toLowerCase();
  const matching = useMemo(
    () => (q.length === 0 ? products : products.filter((p) => p.name.toLowerCase().includes(q))),
    [products, q],
  );
  const visible = useMemo(() => applyProductFilter(filter, matching), [filter, matching]);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Icons.product}
        title="No products for sale yet"
        message="Salons on Growth and Pro can sell products for collection. When they list some, they show up here."
      />
    );
  }

  if (visible.length === 0) {
    const filtered = productFilterIsActive(filter);
    return (
      <EmptyState
        icon={q.length > 0 ? Icons.searchEmpty : Icons.filterOff}
        title={q.length > 0 ? "No matches" : "Nothing in that price range"}
        message={
          q.length > 0
            ? `Nothing matches “${query.trim()}”.`
            : "Try widening the range, or clearing the filter."
        }
        action={
          filtered ? (
            <Button variant="outlined" onClick={onClearFilter}>
              Clear filter
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
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
      <ul className="gap-md grid grid-cols-[repeat(auto-fill,minmax(min(45%,10rem),1fr))]">
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

      <ProductSheet
        product={open}
        qty={open ? qtyOf(open.id) : 0}
        onSetQty={(qty) => open && setProductQty(open, qty)}
        onAdd={() => open && addProduct(open)}
        onClose={() => setOpen(null)}
      />
      {dialog}
    </>
  );
}
