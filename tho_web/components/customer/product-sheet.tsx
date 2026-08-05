"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { QtyStepper } from "@/components/customer/qty-stepper";
import type { Product } from "@/lib/types/salon";
import { formatNu } from "@/lib/utils";

/**
 * A product's detail and quantity — a port of `showProductSheet` in
 * `tho/app/lib/customer/shop/product_sheet.dart`.
 *
 * **Deliberately cart-free**, exactly as the Dart is: it reports a quantity through `onSetQty` and
 * lets the host — which owns the cart — decide what that means, *including refusing the add because
 * the cart belongs to another salon*. A sheet that wrote to the cart itself could not offer that
 * choice, and the one-salon rule is where the interesting case lives.
 *
 * The photo is the reason this exists rather than a bigger card: a card row can carry a name and a
 * price, and a customer deciding between two shampoos wants the description and a look at the bottle.
 */
export function ProductSheet({
  product,
  qty,
  onSetQty,
  onAdd,
  onClose,
}: {
  product: Product | null;
  qty: number;
  onSetQty: (qty: number) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  if (!product) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      footer={
        qty === 0 ? (
          <Button fullWidth onClick={onAdd}>
            <Icons.add style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
            Add to cart · {formatNu(product.priceNu)}
          </Button>
        ) : (
          <div className="gap-base flex items-center justify-between">
            <span className="text-body-sm text-muted">
              {qty} in your cart · {formatNu(product.priceNu * qty)}
            </span>
            <QtyStepper qty={qty} label={product.name} onChange={onSetQty} />
          </div>
        )
      }
    >
      <div className="gap-base flex flex-col">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-md">
          <CoverImage
            label={product.name}
            imageUrl={product.photoUrl}
            sizes="(min-width: 744px) 560px, 100vw"
          />
        </div>

        <p className="text-display-sm text-ink font-semibold tabular-nums">
          {formatNu(product.priceNu)}
        </p>

        {product.description ? (
          <p className="text-body-md text-body">{product.description}</p>
        ) : (
          <p className="text-body-sm text-muted">No description for this one.</p>
        )}

        {product.businessName ? (
          <Link
            href={`/salon/${product.businessId}`}
            className="border-hairline-soft p-md gap-md hover:bg-surface-soft flex items-center rounded-md border"
          >
            <span className="bg-surface-soft text-ink grid size-10 shrink-0 place-items-center rounded-sm">
              <Icons.salon style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-title text-ink block truncate font-medium">
                {product.businessName}
              </span>
              <span className="text-body-sm text-muted block">
                Collect and pay here — see the salon
              </span>
            </span>
            <Icons.chevronRight
              className="text-muted-soft shrink-0"
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          </Link>
        ) : null}

        <p className="text-caption-sm text-muted">
          Nothing is charged online. You pay in cash when you collect.
        </p>
      </div>
    </Sheet>
  );
}
