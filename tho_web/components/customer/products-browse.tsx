"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { ProductCard } from "@/components/customer/product-card";
import { ProductSheet } from "@/components/customer/product-sheet";
import {
  applyProductFilter,
  productFilterIsActive,
  type ProductFilter,
} from "@/lib/product-filter";
import type { Product } from "@/lib/types/salon";
import { useCart } from "@/lib/use-cart";

/**
 * The cross-salon products grid — a port of `ProductsBrowse` in
 * `tho/app/lib/customer/shop/products_browse.dart`.
 *
 * The catalogue arrives from the server (`fetchProducts`), so this component's job is the three
 * things that need a browser: the name match, the filter, and the cart.
 *
 * ## Adding across salons
 *
 * The cart holds one salon's products because `place_order` takes one `p_business`. When a customer
 * adds something from a second salon, `addToCart` refuses and returns the cart they *would* have —
 * so instead of an error this offers the choice: keep the current cart, or start again with this. The
 * app throws `CartSalonMismatch` and the browse catches it into a toast with no way forward, which
 * leaves the customer to work out that they must empty the cart by hand.
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
  const { cart, add, setQty, replace } = useCart();
  const [open, setOpen] = useState<Product | null>(null);

  const q = query.trim().toLowerCase();
  const matching = useMemo(
    () => (q.length === 0 ? products : products.filter((p) => p.name.toLowerCase().includes(q))),
    [products, q],
  );
  const visible = useMemo(() => applyProductFilter(filter, matching), [filter, matching]);

  const qtyOf = (id: string) => cart.lines.find((l) => l.productId === id)?.qty ?? 0;

  function addProduct(product: Product) {
    const result = add(product);
    if (result.ok) return;
    // The one-salon rule. Offer the way through rather than just the refusal.
    toast.error(`Your cart has items from another salon.`, {
      description: `Start a new cart with ${product.name}?`,
      action: {
        label: "Start new",
        onClick: () => {
          replace(result.replacement);
          toast.success(`Cart replaced with ${product.name}.`);
        },
      },
    });
  }

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
      <ul className="gap-md grid grid-cols-1 tablet:grid-cols-2 wide:grid-cols-3">
        {visible.map((product) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              qty={qtyOf(product.id)}
              showSalon
              onAdd={() => addProduct(product)}
              onSetQty={(qty) => setQty(product.id, qty)}
              onOpen={() => setOpen(product)}
            />
          </li>
        ))}
      </ul>

      <ProductSheet
        product={open}
        qty={open ? qtyOf(open.id) : 0}
        onSetQty={(qty) => open && setQty(open.id, qty)}
        onAdd={() => open && addProduct(open)}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
