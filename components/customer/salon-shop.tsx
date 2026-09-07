"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { ProductRailCard } from "@/components/ui/product-card";
import { ProductSheet } from "@/components/customer/product-sheet";
import { useOrderCart } from "@/components/customer/use-order-cart";
import type { Product } from "@/lib/types/salon";

/**
 * A salon's shelf — the Shop tab, ported from
 * `tho/app/lib/customer/shop/salon_shop_tab.dart`.
 *
 * **No filter or search here, unlike the cross-salon browse.** One salon's shelf is a handful of
 * items — four is the live maximum — and a sort control over three products is furniture. The app
 * offers the filter on this tab too, and the tab's own comment calls it optional.
 *
 * The one-salon conflict is more likely on this tab than anywhere: a customer with a cart from salon
 * A opening salon B's shop is the ordinary case, not the edge. `useOrderCart` owns the question that
 * raises, and now names the salon from the product itself — `product_cards` joins `business_name` on
 * every read, where the old bare-table select left it null and this component had to pass its own
 * `salonName` down to say it.
 *
 * **`ProductRailCard`, not the grid form**, even though this lays out as a grid: the salon is the
 * page you are already on, so naming it on every card would be the same word repeated down the
 * screen. That is upstream's split exactly, and it is a property of the shelf rather than of the
 * layout.
 *
 * `SalonTabs` renders this only when the salon has in-stock products, which is why there is no
 * "shop closed" state — the tab simply isn't there. The empty state below covers the race where the
 * last item sold out between the server render and a client refresh.
 */
export function SalonShop({ products }: { products: Product[] }) {
  const { qtyOf, addProduct, setProductQty, dialog } = useOrderCart();
  const [open, setOpen] = useState<Product | null>(null);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Icons.product}
        title="Nothing in stock right now"
        message="This salon sells products for collection, but everything is sold out at the moment."
      />
    );
  }

  return (
    <>
      <p className="text-body-sm text-muted mb-base">
        Order now and collect at the salon — you pay in cash when you pick it up.
      </p>

      {/* The same track as the cross-salon browse. A salon's shelf is four items at most
          today, so this is two columns on a phone and one row on anything wider — but it is
          the same rule rather than a second hand-picked one, which is the point. */}
      <ul className="gap-md grid grid-cols-[repeat(auto-fill,minmax(min(45%,10rem),1fr))]">
        {products.map((product) => (
          <li key={product.id}>
            <ProductRailCard
              product={product}
              qty={qtyOf(product.id)}
              onAdd={() => addProduct(product)}
              onSetQty={(qty) => setProductQty(product, qty)}
              onOpen={() => setOpen(product)}
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
