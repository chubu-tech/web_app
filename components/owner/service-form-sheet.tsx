"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CoverImage } from "@/components/ui/cover-image";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createService, updateService, uploadOwnerImage } from "@/lib/api/owner-setup";
import { downscaleImage, imageRejection, releasePreview } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import {
  SERVICE_CATEGORY_MAX_LENGTH,
  SERVICE_CATEGORY_PRESETS,
  SERVICE_GENDERS,
  type ServiceItem,
} from "@/lib/types/salon";

/**
 * Add or edit one service — a port of `_ServiceForm` in `business_services_tab.dart`.
 *
 * **The validation mirrors the CHECK constraints**, so a bad value comes back as a sentence
 * rather than as `services_duration_minutes_check`. `duration_minutes > 0`, `price >= 0`, and
 * `category` is null or a trimmed string of at most `SERVICE_CATEGORY_MAX_LENGTH` characters.
 *
 * **The owner names their own categories.** `SERVICE_CATEGORY_PRESETS` used to be the whole
 * vocabulary the column allowed; it is now a row of suggestions, and `salonCategories` — the
 * groups this salon already files under — comes first, because on a long menu those are the
 * ones being reused and seven generic suggestions above them buries them. A name typed here
 * is held in state and only becomes real when the service saves: `services.category` is the
 * record, so there is nothing to clean up after an abandoned sheet.
 *
 * **Tapping the chosen category again clears it**, which is the app's behaviour and the only
 * way to un-file a service: the column is nullable and a service that belongs in no group has
 * to stay possible. The app's *update* path is the one that gets this wrong in the other
 * direction — it spreads `if (x != null)`, so clearing never reaches the database. Here every
 * field is sent, nulls included.
 *
 * **The photo uploads on pick, before Save.** It has to: the upload returns the URL that the
 * row then stores, and holding a blob across a form submit for a service that might not be
 * created is worse. An abandoned sheet can therefore leave one orphaned object in the bucket
 * — accepted, and the same trade the customer avatar makes.
 *
 * **Mounted only while open, and keyed by the service** (see `ServiceList`), so every field
 * initialises from the row on mount. The first version synchronised them in an effect instead,
 * which both cascades renders and shows the *previous* service's values for a frame when Edit
 * is used twice in a row.
 */
export function ServiceFormSheet({
  businessId,
  service,
  salonCategories,
  onClose,
}: {
  businessId: string;
  service: ServiceItem | null;
  /** The groups this salon already files services under, in menu order. */
  salonCategories: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(service?.name ?? "");
  const [duration, setDuration] = useState(String(service?.durationMinutes ?? 30));
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [gender, setGender] = useState<string>(service?.gender ?? "unisex");
  const [category, setCategory] = useState<string | null>(service?.category ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(service?.imageUrl ?? null);
  /** A group typed in this sheet and not yet saved under anything. */
  const [typedCategory, setTypedCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Every chip the category row offers: this salon's own groups first, in its own order,
   * then the presets it has not used, then whatever has just been typed. Compared
   * case-insensitively so "hair care" cannot appear beside "Hair Care" — in a price list
   * those are one heading, and two chips claiming to be it is worse than a rejection.
   */
  const categoryChips: string[] = [];
  const seen = new Set<string>();
  for (const c of [...salonCategories, ...SERVICE_CATEGORY_PRESETS, typedCategory]) {
    const trimmed = c?.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    categoryChips.push(trimmed);
  }

  /** Take the typed name — or, if it already exists in any casing, select that one. */
  function addCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      setAddingCategory(false);
      return;
    }
    if (trimmed.length > SERVICE_CATEGORY_MAX_LENGTH) {
      setError(
        `Keep a category under ${SERVICE_CATEGORY_MAX_LENGTH} characters — it has to fit a heading.`,
      );
      return;
    }
    const existing = categoryChips.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    setCategory(existing ?? trimmed);
    if (!existing) setTypedCategory(trimmed);
    setNewCategory("");
    setAddingCategory(false);
    setError(null);
  }

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
        `service-${businessId}`,
        picked.mime,
        imageUrl,
      );
      setImageUrl(url);
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
    const minutes = Number.parseInt(duration.trim(), 10);
    const amount = Number.parseFloat(price.trim());
    if (!trimmed || !Number.isFinite(minutes) || minutes <= 0) {
      setError("Enter a name and a duration of at least one minute.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a price — 0 if this one is free.");
      return;
    }

    setSaving(true);
    setError(null);
    const fields = {
      name: trimmed,
      durationMinutes: minutes,
      price: amount,
      gender,
      category,
      imageUrl,
    };
    try {
      const supabase = createClient();
      if (service) {
        await updateService(supabase, service.id, fields);
      } else {
        await createService(supabase, businessId, fields);
      }
      toast.success("Saved.");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(ownerErrorMessage("saveService", caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={service ? "Edit service" : "Add service"}
      footer={
        <Button fullWidth busy={saving} onClick={() => void save()}>
          Save
        </Button>
      }
    >
      <div className="gap-base flex flex-col">
        <div className="gap-base flex items-center">
          <span className="size-24 shrink-0 overflow-hidden rounded-md">
            <CoverImage label={name || "Service"} imageUrl={imageUrl} sizes="96px" />
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
              <Icons.camera
                style={{ width: IconSize.xs, height: IconSize.xs }}
                aria-hidden
              />
              {imageUrl ? "Change photo" : "Add photo"}
            </Button>
            <p className="text-caption-sm text-muted">JPEG, PNG or WebP, up to 8 MB.</p>
          </div>
        </div>

        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Haircut & Style" />

        <div className="gap-base grid grid-cols-2">
          <Field
            label="Duration (min)"
            value={duration}
            onChange={setDuration}
            type="number"
            inputMode="numeric"
            min={1}
          />
          <Field
            label="Price (Nu)"
            value={price}
            onChange={setPrice}
            type="number"
            inputMode="decimal"
            min={0}
          />
        </div>
        <p className="text-caption-sm text-muted -mt-sm">
          Duration sets how long the booking blocks, and the wait estimate in your walk-in
          line.
        </p>

        <fieldset>
          <legend className="text-caption text-muted mb-sm font-medium">For</legend>
          <div className="gap-sm flex flex-wrap">
            {SERVICE_GENDERS.map((g) => (
              <Chip
                key={g.value}
                label={g.label}
                selected={gender === g.value}
                onClick={() => setGender(g.value)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-caption text-muted mb-sm font-medium">Category</legend>
          <div className="gap-sm flex flex-wrap">
            {categoryChips.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={category === c}
                // Tapping the chosen one clears it — the only way to un-file a service.
                onClick={() => setCategory((current) => (current === c ? null : c))}
              />
            ))}
            {/* Not a Chip: it files this service under nothing by itself, and dressing it
                as one of the choices would say it does. */}
            {!addingCategory ? (
              <Button variant="quiet" onClick={() => setAddingCategory(true)}>
                <Icons.add style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
                New category
              </Button>
            ) : null}
          </div>

          {addingCategory ? (
            <div className="gap-sm mt-sm flex items-end">
              <span className="flex-1">
                <Field
                  label="New category"
                  value={newCategory}
                  onChange={setNewCategory}
                  placeholder="e.g. Threading & Waxing"
                  maxLength={SERVICE_CATEGORY_MAX_LENGTH}
                  autoFocus
                  // Enter is the fast path — an owner filing a dozen groups is typing,
                  // not reaching for a button. Not a nested <form>: this sheet's Save is
                  // the submit, and Enter here must not trigger it.
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategory();
                    }
                  }}
                />
              </span>
              <Button variant="quiet" onClick={addCategory} className="mb-1">
                Add
              </Button>
            </div>
          ) : null}

          <p className="text-caption-sm text-muted mt-sm">
            Groups this service on your salon page, under a heading you name. New categories
            go to the bottom of your menu. Optional.
          </p>
        </fieldset>

        {error ? <p className="text-body-sm text-error-text">{error}</p> : null}
      </div>
    </Sheet>
  );
}
