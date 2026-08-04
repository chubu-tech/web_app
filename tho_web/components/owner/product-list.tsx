"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ProductFormSheet } from "@/components/owner/product-form-sheet";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { setProductArchived, setProductStock } from "@/lib/api/owner-back-office";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types/salon";
import { formatNu } from "@/lib/utils";

/**
 * The storefront — a port of `tho/app/lib/business/shop/products_section.dart`, which is the
 * second segment of the app's Services tab.
 *
 * **Its own route here, not a segment.** 3b turned the app's Settings accordions into real
 * pages for the reasons a browser makes free — a linkable, reloadable, back-button-correct URL —
 * and products are a longer-lived noun than a tab within a tab. `/business/services` stays about
 * what the salon *does*; this is about what it *sells*.
 *
 * **Stock writes immediately; the rest waits for Save.** A switch is already a complete,
 * deliberate act, and "sold out" is the one thing an owner flips mid-shift with a customer in
 * front of them. Same split as the service list.
 *
 * **Remove is an archive, with an Undo that restores the exact previous state.** An
 * `order_items` row references a product by id, so a real delete would erase what a past order
 * *was*. `is_archived` is this table's delete, and because it is reversible the Undo is honest
 * rather than a second write hoping to land.
 */
export function ProductList({
  businessId,
  products,
}: {
  businessId: string;
  products: Product[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleStock(product: Product) {
    setBusyId(product.id);
    try {
      await setProductStock(createClient(), product.id, !product.inStock);
      toast.success(
        product.inStock ? `${product.name} is sold out.` : `${product.name} is back in stock.`,
      );
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("toggleProductStock", caught));
    } finally {
      setBusyId(null);
    }
  }

  async function archive(product: Product) {
    setBusyId(product.id);
    try {
      await setProductArchived(createClient(), product.id, true);
      router.refresh();
      toast.success(`${product.name} removed.`, {
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                await setProductArchived(createClient(), product.id, false);
                router.refresh();
              } catch (caught) {
                toast.error(ownerErrorMessage("restoreProduct", caught));
              }
            })();
          },
        },
      });
    } catch (caught) {
      toast.error(ownerErrorMessage("archiveProduct", caught));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <SectionHeader title="Products" as="h1" />
      <p className="text-body-sm text-muted mb-base">
        What customers can order from your salon page and collect in person. Payment happens at
        the counter — nothing is taken online.
      </p>

      <div className="mb-lg">
        <Button onClick={() => setEditing("new")}>
          <Icons.add style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Add product
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Icons.product}
          title="No products yet"
          message="Add products customers can order for cash pickup."
          action={<Button onClick={() => setEditing("new")}>Add product</Button>}
        />
      ) : (
        <ul className="gap-md grid tablet:grid-cols-2">
          {products.map((p) => {
            const soldOut = !p.inStock;
            return (
              <li
                key={p.id}
                className="border-hairline-soft p-sm gap-md flex items-center rounded-md border"
              >
                {/* Sold-out rows dim to 55%, as the app's do — the row is still there, and
                    still editable, but it is not what a customer can buy. */}
                <span
                  className={`size-13 shrink-0 overflow-hidden rounded-sm ${soldOut ? "opacity-55" : ""}`}
                >
                  <CoverImage label={p.name} imageUrl={p.photoUrl} sizes="52px" />
                </span>

                <span className={`min-w-0 flex-1 ${soldOut ? "opacity-55" : ""}`}>
                  <span className="gap-sm flex items-center">
                    <span className="text-title text-ink truncate font-medium">{p.name}</span>
                    {soldOut ? <StatusPill status="Sold out" /> : null}
                  </span>
                  <span className="text-body-sm text-muted block">{formatNu(p.priceNu)}</span>
                  {p.description ? (
                    <span className="text-caption-sm text-muted block truncate">
                      {p.description}
                    </span>
                  ) : null}
                </span>

                <Button
                  variant="quiet"
                  onClick={() => setEditing(p)}
                  aria-label={`Edit ${p.name}`}
                  className="px-sm shrink-0"
                >
                  <Icons.edit style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => void archive(p)}
                  aria-label={`Remove ${p.name}`}
                  className="px-sm shrink-0"
                >
                  <Icons.trash style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
                </Button>
                <label className="gap-xs flex shrink-0 cursor-pointer items-center">
                  <span className="sr-only">
                    {p.inStock ? `Mark ${p.name} sold out` : `Put ${p.name} back in stock`}
                  </span>
                  <input
                    type="checkbox"
                    checked={p.inStock}
                    disabled={busyId === p.id}
                    onChange={() => void toggleStock(p)}
                    className="accent-rausch-cta size-5"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null ? (
        <ProductFormSheet
          key={editing === "new" ? "new" : editing.id}
          businessId={businessId}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
