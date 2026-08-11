"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createProduct, updateProduct } from "@/lib/api/owner-back-office";
import { uploadOwnerImage } from "@/lib/api/owner-setup";
import { downscaleImage, imageRejection, releasePreview } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types/salon";

/**
 * Add or edit a product — a port of `_ProductForm` in
 * `tho/app/lib/business/shop/product_edit_sheet.dart`.
 *
 * Same shape as `ServiceFormSheet` for the same reasons: mounted only while open and keyed by
 * the row, so fields initialise on mount rather than being synchronised in an effect; the photo
 * uploads on pick because the upload is what produces the URL the row stores; every field is
 * sent on save, nulls included, so a description or a photo can be **cleared**.
 *
 * **The upload path is `<uid>/product-…`, not the app's `product/<businessId>/…`.** The app's
 * shape fails `media_auth_insert`, which requires `(storage.foldername(name))[1] = auth.uid()`
 * — the same reason none of the owner's photo uploads have worked in the Flutter app since
 * `20260720000001`. See `uploadOwnerImage`.
 *
 * Validation mirrors the one CHECK this table has: `products_price_nu_check` is `price_nu >= 0`,
 * so 0 is legal and a giveaway is expressible. The column is an `integer` — Nu, not chetrum —
 * so the price is parsed as one.
 */
export function ProductFormSheet({
  businessId,
  product,
  onClose,
}: {
  businessId: string;
  product: Product | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.priceNu) : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(product?.photoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickImage(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const rejection = imageRejection(file);
    if (rejection) {
      toast.error(rejection);
      return;
    }
    setUploading(true);
    const picked = await downscaleImage(file);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");
      const url = await uploadOwnerImage(
        supabase,
        user.id,
        picked.blob,
        `product-${businessId}`,
        picked.mime,
        photoUrl,
      );
      setPhotoUrl(url);
      toast.success("Photo uploaded.");
    } catch (caught) {
      toast.error(ownerErrorMessage("uploadPhoto", caught));
    } finally {
      releasePreview(picked);
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save() {
    const trimmed = name.trim();
    const amount = Number.parseInt(price.trim(), 10);
    if (!trimmed) {
      setError("Give the product a name.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a price in Nu — 0 if you're giving it away.");
      return;
    }

    setSaving(true);
    setError(null);
    const fields = {
      name: trimmed,
      priceNu: amount,
      description: description.trim() || null,
      photoUrl,
    };
    try {
      const supabase = createClient();
      if (product) {
        await updateProduct(supabase, product.id, fields);
      } else {
        await createProduct(supabase, businessId, fields);
      }
      toast.success("Saved.");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(ownerErrorMessage("saveProduct", caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={product ? "Edit product" : "Add product"}
      footer={
        <Button fullWidth busy={saving} onClick={() => void save()}>
          Save
        </Button>
      }
    >
      <div className="gap-base flex flex-col">
        <div className="gap-base flex items-center">
          <span className="size-24 shrink-0 overflow-hidden rounded-md">
            <CoverImage label={name || "Product"} imageUrl={photoUrl} sizes="96px" />
          </span>
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pickImage(e.target.files)}
            />
            <Button
              variant="quiet"
              busy={uploading}
              onClick={() => fileInput.current?.click()}
              className="px-0"
            >
              <Icons.camera style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
              {photoUrl ? "Change photo" : "Add photo"}
            </Button>
            <p className="text-caption-sm text-muted">JPEG, PNG or WebP, up to 8 MB.</p>
          </div>
        </div>

        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Argan Hair Oil" />
        <Field
          label="Price (Nu)"
          value={price}
          onChange={setPrice}
          type="number"
          inputMode="numeric"
          min={0}
        />
        <Field
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="What is it, how to use it…"
        />

        {error ? <p className="text-body-sm text-error-text">{error}</p> : null}
      </div>
    </Sheet>
  );
}
