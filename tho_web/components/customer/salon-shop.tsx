"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { ProductCard } from "@/components/customer/product-card";
import { ProductSheet } from "@/components/customer/product-sheet";
import type { Product } from "@/lib/types/salon";
import { useCart } from "@/lib/use-cart";

/**
 * A salon's shelf — the Shop tab, ported from
 * `tho/app/lib/customer/shop/salon_shop_tab.dart`.
 *
 * **No filter or search here, unlike the cross-salon browse.** One salon's shelf is a handful of
 * items — four is the live maximum — and a sort control over three products is furniture. The app
 * offers the filter on this tab too, and the tab's own comment calls it optional.
 *
 * The one-salon conflict is more likely on this tab than anywhere: a customer with a cart from salon
 * A opening salon B's shop is the ordinary case, not the edge. So the offer to start again names both
 * the product and what is being replaced.
 *
 * `SalonTabs` renders this only when the salon has in-stock products, which is why there is no
 * "shop closed" state — the tab simply isn't there. The empty state below covers the race where the
 * last item sold out between the server render and a client refresh.
 */
export function SalonShop({
  products,
  salonName,
}: {
  products: Product[];
  salonName: string;
}) {
  const { cart, add, setQty, replace } = useCart();
  const [open, setOpen] = useState<Product | null>(null);

  const qtyOf = (id: string) => cart.lines.find((l) => l.productId === id)?.qty ?? 0;

  function addProduct(product: Product) {
    const result = add(product);
    if (result.ok) return;
    toast.error("Your cart has items from another salon.", {
      description: `Start a new cart with ${product.name} from ${salonName}?`,
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

      <ul className="gap-md flex flex-col">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              qty={qtyOf(product.id)}
              showSalon={false}
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
