"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PinPicker } from "@/components/owner/pin-picker";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CoverImage } from "@/components/ui/cover-image";
import { Field, SelectField } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import {
  addBusinessPhoto,
  deleteBusinessPhoto,
  setBusinessCategories,
  updateBusiness,
  uploadOwnerImage,
  type BusinessFields,
} from "@/lib/api/owner-setup";
import { hasFeature } from "@/lib/entitlements";
import { downscaleImage, imageRejection, releasePreview } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { fetchBusinessPhotos } from "@/lib/api/salon";
import {
  BUSINESS_TYPES,
  travels as isTravelling,
  type Business,
  type BusinessPhoto,
  type BusinessType,
  type Category,
} from "@/lib/types/salon";

/** `businesses_service_radius_km_check` — mirrored so a bad value is a sentence, not a 23514. */
const MAX_RADIUS_KM = 200;

const REMINDER_CHANNELS = [
  { value: "push", label: "Push" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
];

/**
 * The salon's own details — name, type, contact, categories, photos, the map pin, its booking
 * rules and its queue switches.
 *
 * Three behaviours are kept from the app because something downstream depends on each:
 *
 * - **A revenue goal of 0 is stored as null.** The dashboard gauge reads null as "no target"
 *   and shows an em dash; a literal zero would make every month 0% of nothing.
 * - **Changing away from a travelling type clears `service_radius_km`.** Otherwise a salon
 *   that switched back to a shopfront keeps claiming it travels 10 km.
 * - **An empty WhatsApp number is null, not "".** `whatsappUrl` hides the button on null; a
 *   blank string is a value, and `wa.me/` with nothing after it is a broken link.
 *
 * The queue block is the switch 3a's board gates on, so the two now demonstrably agree: turn
 * it off here and the board locks with *"you've switched the queue off"* rather than the plan
 * message.
 */
export function SalonProfileForm({
  business,
  categories,
  initialCategoryIds,
  initialPhotos,
}: {
  business: Business;
  categories: Category[];
  initialCategoryIds: string[];
  initialPhotos: BusinessPhoto[];
}) {
  const router = useRouter();
  const [name, setName] = useState(business.name);
  const [type, setType] = useState<BusinessType>(business.businessType);
  const [radius, setRadius] = useState(
    business.serviceRadiusKm == null ? "" : String(business.serviceRadiusKm),
  );
  const [address, setAddress] = useState(business.addressText ?? "");
  const [phone, setPhone] = useState(business.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(business.whatsappPhone ?? "");
  const [coverUrl, setCoverUrl] = useState(business.coverUrl);
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);
  const [pin, setPin] = useState<{ lat: number | null; lng: number | null }>({
    lat: business.lat,
    lng: business.lng,
  });
  const [cancelWindow, setCancelWindow] = useState(String(business.cancellationWindowHours));
  const [goal, setGoal] = useState(
    business.monthlyRevenueGoal == null ? "" : String(business.monthlyRevenueGoal),
  );
  const [rebookingEnabled, setRebookingEnabled] = useState(business.rebookingEnabled);
  const [rebookingDays, setRebookingDays] = useState(String(business.rebookingDays));
  const [queueEnabled, setQueueEnabled] = useState(business.queueEnabled);
  const [queueMode, setQueueMode] = useState(business.queueJoinMode);
  const [reminderChannel, setReminderChannel] = useState(business.reminderChannel);
  const [photos, setPhotos] = useState(initialPhotos);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const travels = isTravelling({ businessType: type });
  const runsQueueOnPlan = hasFeature(business.plan, "walkInQueue");
  const canPickChannel = hasFeature(business.plan, "deposits");

  async function upload(
    files: FileList | null,
    label: string,
    previous: string | null,
    onDone: (url: string) => Promise<void> | void,
    setBusy: (busy: boolean) => void,
    input: HTMLInputElement | null,
  ) {
    const file = files?.[0];
    if (!file) return;
    const rejection = imageRejection(file);
    if (rejection) {
      toast.error(rejection);
      return;
    }
    setBusy(true);
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
        label,
        picked.mime,
        previous,
      );
      await onDone(url);
    } catch (caught) {
      toast.error(ownerErrorMessage("uploadPhoto", caught));
    } finally {
      releasePreview(picked);
      setBusy(false);
      if (input) input.value = "";
    }
  }

  async function save() {
    const trimmedName = name.trim();
    const window = Number.parseInt(cancelWindow.trim(), 10);
    if (!trimmedName || !Number.isFinite(window) || window < 0) {
      setError("Enter a name and a cancellation window in hours (0 or more).");
      return;
    }

    let radiusKm: number | null = null;
    if (travels && radius.trim()) {
      radiusKm = Number.parseFloat(radius.trim());
      if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) {
        setError(`Enter a travel radius between 1 and ${MAX_RADIUS_KM} km, or leave it blank.`);
        return;
      }
    }

    // Blank clears the goal; 0 also means "no goal", because that is what the dashboard gauge
    // reads null as. A literal zero would make every month 0% of nothing.
    let monthlyGoal: number | null = null;
    if (goal.trim()) {
      const parsed = Number.parseFloat(goal.trim());
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Enter a monthly revenue goal, or leave it blank.");
        return;
      }
      monthlyGoal = parsed === 0 ? null : parsed;
    }

    const days = Number.parseInt(rebookingDays.trim(), 10);
    if (!Number.isFinite(days) || days <= 0) {
      setError("Enter how many days after a visit to nudge a customer.");
      return;
    }

    const fields: BusinessFields = {
      name: trimmedName,
      addressText: address.trim() || null,
      phone: phone.trim() || null,
      whatsappPhone: whatsapp.trim() || null,
      businessType: type,
      // A shopfront has no travel radius, and clearing it on a type change stops a stale
      // "travels 10 km" surviving the switch back.
      serviceRadiusKm: travels ? radiusKm : null,
      lat: pin.lat,
      lng: pin.lng,
      cancellationWindowHours: window,
      queueEnabled,
      queueJoinMode: queueMode,
      reminderChannel,
      monthlyRevenueGoal: monthlyGoal,
      rebookingEnabled,
      rebookingDays: days,
    };

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      await updateBusiness(supabase, business.id, fields);
      await setBusinessCategories(supabase, business.id, categoryIds);
      toast.success("Saved.");
      router.refresh();
    } catch (caught) {
      setError(ownerErrorMessage("saveSalon", caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <Link
        href="/business/settings"
        className="text-caption text-rausch-cta gap-xs mb-sm inline-flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        Settings
      </Link>
      <SectionHeader title="Salon details" as="h1" />

      {/* ------------------------------------------------------------ cover ---- */}
      <div className="mt-base relative">
        <span className="block h-40 overflow-hidden rounded-md">
          <CoverImage label={name || business.name} imageUrl={coverUrl} sizes="720px" />
        </span>
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) =>
            void upload(
              e.target.files,
              `salon-${business.id}-cover`,
              coverUrl,
              async (url) => {
                // Saved immediately, like the app: the URL is what the row stores, and a cover
                // that only lands on Save would be lost by anyone who navigated away.
                await updateBusiness(createClient(), business.id, { coverUrl: url });
                setCoverUrl(url);
                toast.success("Cover photo updated.");
              },
              setUploadingCover,
              coverInput.current,
            )
          }
        />
        <span className="absolute right-3 bottom-3">
          <Button
            variant="outlined"
            busy={uploadingCover}
            onClick={() => coverInput.current?.click()}
            className="bg-canvas"
          >
            <Icons.camera style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
            {coverUrl ? "Change cover" : "Add cover"}
          </Button>
        </span>
      </div>

      {/* ------------------------------------------------------------ basics --- */}
      <div className="gap-base mt-lg flex flex-col">
        <Field label="Salon name" value={name} onChange={setName} />

        <fieldset>
          <legend className="text-caption text-muted mb-sm font-medium">Business type</legend>
          <div className="gap-sm flex flex-wrap">
            {BUSINESS_TYPES.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                selected={type === t.value}
                onClick={() => setType(t.value)}
              />
            ))}
          </div>
        </fieldset>

        {travels ? (
          <Field
            label="How far will you travel? (km)"
            value={radius}
            onChange={setRadius}
            type="number"
            inputMode="decimal"
            min={1}
            max={MAX_RADIUS_KM}
            placeholder="e.g. 10"
            hint="Shown to customers instead of a shopfront address."
          />
        ) : null}

        <Field
          label={travels ? "Area (optional)" : "Address"}
          value={address}
          onChange={setAddress}
          placeholder={travels ? "e.g. Changangkha and nearby" : "Street, town"}
        />
        <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
        <Field
          label="WhatsApp number"
          value={whatsapp}
          onChange={setWhatsapp}
          type="tel"
          placeholder="+975 17 12 34 56"
          hint="Adds a WhatsApp button to your salon page. Leave blank to hide it."
        />

        {categories.length > 0 ? (
          <fieldset>
            <legend className="text-caption text-muted mb-sm font-medium">Categories</legend>
            <div className="gap-sm flex flex-wrap">
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={categoryIds.includes(c.id)}
                  onClick={() =>
                    setCategoryIds((current) =>
                      current.includes(c.id)
                        ? current.filter((id) => id !== c.id)
                        : [...current, c.id],
                    )
                  }
                />
              ))}
            </div>
            <p className="text-caption-sm text-muted mt-sm">
              Which category rows on Discover your salon appears under.
            </p>
          </fieldset>
        ) : null}
      </div>

      {/* --------------------------------------------------------------- pin --- */}
      <div className="mt-xl">
        <SectionHeader title="On the map" as="h2" />
        <PinPicker
          name={name || business.name}
          coverUrl={coverUrl}
          lat={pin.lat}
          lng={pin.lng}
          onChange={setPin}
        />
      </div>

      {/* ----------------------------------------------------------- gallery --- */}
      <div className="mt-xl">
        <SectionHeader
          title="Gallery"
          as="h2"
          action={
            <>
              <input
                ref={galleryInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  void upload(
                    e.target.files,
                    `salon-${business.id}-gallery`,
                    null,
                    async (url) => {
                      const supabase = createClient();
                      await addBusinessPhoto(supabase, business.id, url);
                      // Re-read for the row id, which removal needs and the insert does not
                      // return.
                      setPhotos(await fetchBusinessPhotos(supabase, business.id));
                      toast.success("Photo added.");
                    },
                    setAddingPhoto,
                    galleryInput.current,
                  )
                }
              />
              <Button
                variant="quiet"
                busy={addingPhoto}
                onClick={() => galleryInput.current?.click()}
              >
                <Icons.addPhoto style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
                Add
              </Button>
            </>
          }
        />
        <p className="text-body-sm text-muted mt-sm">
          Your space, your results, the atmosphere — customers see these on your salon page.
        </p>
        {photos.length > 0 ? (
          <ul className="gap-sm mt-sm flex overflow-x-auto">
            {photos.map((p) => (
              <li key={p.id} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- a plain img: owner
                    uploads in a small horizontal strip, where next/image's layout machinery
                    buys nothing and complicates the delete overlay. */}
                <img
                  src={p.url}
                  alt=""
                  width={84}
                  height={84}
                  className="bg-surface-strong size-21 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => void removePhoto(p.id)}
                  aria-label="Remove this photo"
                  className="bg-canvas border-hairline text-muted hover:text-ink absolute -top-1 -right-1 grid size-7 place-items-center rounded-full border"
                >
                  <Icons.trash style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* ----------------------------------------------------- booking rules --- */}
      <div className="mt-xl gap-base flex flex-col">
        <SectionHeader title="Booking rules" as="h2" />
        <Field
          label="Cancellation window (hours)"
          value={cancelWindow}
          onChange={setCancelWindow}
          type="number"
          inputMode="numeric"
          min={0}
          hint="How many hours before a booking a customer can still cancel it themselves."
        />
        <Field
          label="Monthly revenue goal (Nu)"
          value={goal}
          onChange={setGoal}
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Optional — e.g. 40000"
          hint="Sets the target on your dashboard gauge. Blank or 0 means no target."
        />
      </div>

      {/* ------------------------------------------------------ walk-in queue --- */}
      <div className="mt-xl">
        <SectionHeader title="Walk-in queue" as="h2" />
        {!runsQueueOnPlan ? (
          <div className="border-hairline-soft bg-surface-soft p-base gap-sm flex items-start rounded-md border">
            <Icons.locked
              className="text-muted mt-0.5 shrink-0"
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            <p className="text-body-sm text-muted">
              The walk-in queue is part of the Growth plan. Customers take a place in line from
              their phone and watch their position and wait.
            </p>
          </div>
        ) : (
          <>
            <label className="gap-base flex cursor-pointer items-start">
              <input
                type="checkbox"
                checked={queueEnabled}
                onChange={(e) => setQueueEnabled(e.target.checked)}
                className="accent-rausch-cta mt-1 size-5"
              />
              <span>
                <span className="text-title text-ink block font-medium">Run a walk-in queue</span>
                <span className="text-body-sm text-muted block">
                  {queueEnabled
                    ? "Customers can take a place in line."
                    : "Off — your salon is appointment-only."}
                </span>
              </span>
            </label>

            {queueEnabled ? (
              <fieldset className="mt-base">
                <legend className="text-caption text-muted mb-sm font-medium">Who can join</legend>
                <div className="gap-sm flex flex-col">
                  {[
                    {
                      value: "anywhere",
                      title: "From anywhere",
                      blurb: "They can join from your salon page, wherever they are.",
                    },
                    {
                      value: "qr_only",
                      title: "QR scan only",
                      blurb:
                        "They must scan the QR in your shop, so the line is only people who are actually there.",
                    },
                  ].map((mode) => (
                    <label
                      key={mode.value}
                      className="border-hairline-soft p-base gap-base flex cursor-pointer items-start rounded-md border"
                    >
                      <input
                        type="radio"
                        name="queue-join-mode"
                        value={mode.value}
                        checked={queueMode === mode.value}
                        onChange={() => setQueueMode(mode.value as Business["queueJoinMode"])}
                        className="accent-rausch-cta mt-1 size-5"
                      />
                      <span>
                        <span className="text-title text-ink block font-medium">{mode.title}</span>
                        <span className="text-body-sm text-muted block">{mode.blurb}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </>
        )}
      </div>

      {/* ------------------------------------------------------ notifications --- */}
      <div className="mt-xl">
        <SectionHeader title="Reminders" as="h2" />

        <label className="gap-base mb-base flex cursor-pointer items-start">
          <input
            type="checkbox"
            checked={rebookingEnabled}
            onChange={(e) => setRebookingEnabled(e.target.checked)}
            className="accent-rausch-cta mt-1 size-5"
          />
          <span>
            <span className="text-title text-ink block font-medium">Rebooking nudges</span>
            <span className="text-body-sm text-muted block">
              Remind a customer to book again when it has been a while.
            </span>
          </span>
        </label>
        <Field
          label="Days since their last visit"
          value={rebookingDays}
          onChange={setRebookingDays}
          type="number"
          inputMode="numeric"
          min={1}
        />
        <p className="text-caption-sm text-muted mt-xs mb-base">
          Stored with your salon. Nothing reads it yet — no reminder has ever been sent from
          either client, so this sets up the behaviour rather than switching it on.
        </p>

        {canPickChannel ? (
          <SelectField
            label="Reminder channel"
            value={reminderChannel}
            onChange={setReminderChannel}
            options={REMINDER_CHANNELS}
            hint="Stored with your salon. Delivery is switched on at launch."
          />
        ) : (
          <div className="border-hairline-soft bg-surface-soft p-base gap-sm flex items-start rounded-md border">
            <Icons.locked
              className="text-muted mt-0.5 shrink-0"
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            <p className="text-body-sm text-muted">
              Choosing between push, SMS and WhatsApp reminders is part of the Pro plan.
            </p>
          </div>
        )}
      </div>

      {error ? <p className="text-body-sm text-error-text mt-lg">{error}</p> : null}

      <div className="mt-xl">
        <Button fullWidth busy={saving} onClick={() => void save()}>
          Save changes
        </Button>
      </div>
    </div>
  );

  async function removePhoto(photoId: string) {
    try {
      await deleteBusinessPhoto(createClient(), photoId);
      setPhotos((current) => current.filter((p) => p.id !== photoId));
    } catch (caught) {
      toast.error(ownerErrorMessage("removePhoto", caught));
    }
  }
}
