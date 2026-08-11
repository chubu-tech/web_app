"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchHairstyles } from "@/lib/api/booking";
import { downscaleImage, imageRejection, releasePreview, type PickedImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { Hairstyle, ServiceItem } from "@/lib/types/salon";

/**
 * Everything the booking carries besides its time — a note, reference photos, and on Pro
 * a style.
 *
 * The values live in the wizard, not here, because the button that submits them is in
 * the summary rail and because stepping back to change a time must not empty a note
 * somebody has already typed. This component is the view.
 */
export type BookingExtras = {
  note: string;
  photos: PickedImage[];
  /** Null when the salon isn't Pro, or nothing was picked. */
  hairstyleId: string | null;
};

export const EMPTY_EXTRAS: BookingExtras = { note: "", photos: [], hairstyleId: null };

/** The app's cap on reference photos. */
const MAX_PHOTOS = 3;

/**
 * Step 4 — **Confirm**, ported from `_BookingExtrasSheet`
 * (`tho/app/lib/customer/booking_screen.dart:478`) and promoted out of the modal it
 * used to be.
 *
 * The app shows this as a bottom sheet over the slot grid, and so did this app until
 * now. As a step it is better in three ways that are not about looks: the summary is
 * beside it instead of behind it, the browser's Back button leaves it (a modal needs its
 * own dismissal and its own focus trap to be reachable at all), and it has room for the
 * photo row at desktop width, where a 512px sheet did not.
 *
 * **Nothing here is uploaded.** Photos are held as blobs and uploaded by the wizard only
 * once the booking exists, so an abandoned flow leaves no orphaned objects in a private
 * bucket — the same rule the sheet followed, and the reason this takes no Supabase client
 * for the photo path.
 */
export function BookingConfirmStep({
  services,
  extras,
  onChange,
  offerStyles,
}: {
  services: ServiceItem[];
  extras: BookingExtras;
  onChange: (next: BookingExtras) => void;
  /**
   * Whether to show the Pro-only style picker.
   *
   * Gated here **as well as** in `set_booking_hairstyle`, so a customer at a Growth salon
   * is never shown a picker whose result the server would refuse (THO-17). No live salon
   * is on Pro, so this is normally false.
   */
  offerStyles: boolean;
}) {
  const [styles, setStyles] = useState<Hairstyle[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The audience of the basket, not of one service: `fetchHairstyles` narrows so a men's
  // cut does not offer updos, and with several services the first one that states a
  // gender is the only signal there is. 24 of 31 live services state none, so this is
  // usually null and the list comes back unnarrowed.
  const gender = services.find((s) => s.gender != null)?.gender ?? null;

  useEffect(() => {
    if (!offerStyles) return;
    let live = true;
    fetchHairstyles(createClient(), gender)
      .then((list) => {
        if (live) setStyles(list);
      })
      .catch(() => {
        // The picker just stays hidden. It is an extra, not a step.
      });
    return () => {
      live = false;
    };
  }, [offerStyles, gender]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);

    const room = MAX_PHOTOS - extras.photos.length;
    const taken = Array.from(files).slice(0, room);
    if (taken.length < files.length) {
      setPhotoError(`You can attach up to ${MAX_PHOTOS} photos.`);
    }

    const accepted: PickedImage[] = [];
    for (const file of taken) {
      const rejection = imageRejection(file);
      if (rejection) {
        setPhotoError(rejection);
        continue;
      }
      accepted.push(await downscaleImage(file));
    }
    if (accepted.length > 0) {
      onChange({ ...extras, photos: [...extras.photos, ...accepted] });
    }
    // Let the same file be picked again after a removal.
    if (fileInput.current) fileInput.current.value = "";
  }

  /**
   * Revoked here, at the moment of removal, and **not** on unmount.
   *
   * This step unmounts every time somebody steps back to change a time, and the photos
   * survive that — so revoking the object URLs on unmount would blank the thumbnails of
   * a booking still being made. The wizard revokes what is left when the flow itself
   * goes away; this handles the one case the wizard cannot see.
   */
  function removePhoto(photo: PickedImage) {
    releasePreview(photo);
    onChange({
      ...extras,
      photos: extras.photos.filter((p) => p.previewUrl !== photo.previewUrl),
    });
  }

  return (
    <div className="gap-xl flex flex-col">
      {styles.length > 0 ? (
        <section>
          <div className="gap-sm mb-xs flex items-center">
            <h2 className="text-display-sm text-ink font-semibold">Pick a style</h2>
            <span className="bg-star/16 text-star text-badge px-sm py-xxs rounded-full font-semibold">
              PRO
            </span>
          </div>
          <p className="text-body-sm text-muted mb-sm">
            Optional — helps your stylist know what you want.
          </p>
          <div className="gap-sm flex flex-wrap">
            {styles.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                selected={extras.hairstyleId === s.id}
                // Re-tapping clears it: "actually, surprise me" has to stay reachable
                // once something has been picked.
                onClick={() =>
                  onChange({
                    ...extras,
                    hairstyleId: extras.hairstyleId === s.id ? null : s.id,
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <label htmlFor="booking-note" className="text-display-sm text-ink mb-sm block font-semibold">
          Add a note
        </label>
        <p className="text-body-sm text-muted mb-sm">
          Optional — anything the salon should know before you arrive.
        </p>
        <textarea
          id="booking-note"
          value={extras.note}
          onChange={(e) => onChange({ ...extras, note: e.target.value })}
          rows={4}
          placeholder="e.g. keep the sides short — going for a clean fade"
          className="border-hairline bg-paper text-body-md text-ink placeholder:text-muted-soft p-md focus:border-ink w-full rounded-md border focus:border-2 focus:outline-none"
        />
      </section>

      <section>
        <div className="gap-md mb-sm flex items-center">
          <h2 className="text-display-sm text-ink flex-1 font-semibold">Reference photos</h2>
          <Button
            variant="quiet"
            onClick={() => fileInput.current?.click()}
            disabled={extras.photos.length >= MAX_PHOTOS}
          >
            <Icons.addPhoto style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
            Add photo
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => void addPhotos(e.target.files)}
          className="sr-only"
        />
        {photoError ? (
          <p role="alert" className="text-body-sm text-error-text mb-sm">
            {photoError}
          </p>
        ) : null}
        {extras.photos.length > 0 ? (
          <ul className="gap-sm flex">
            {extras.photos.map((photo, i) => (
              <li key={photo.previewUrl} className="relative">
                {/* A blob URL, so next/image would only add indirection. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="" className="size-20 rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="bg-ink text-on-primary border-canvas absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border-2"
                >
                  <Icons.close
                    style={{ width: IconSize.xxs, height: IconSize.xxs }}
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-muted">
            Up to {MAX_PHOTOS}. They stay private between you and the salon.
          </p>
        )}
      </section>
    </div>
  );
}
