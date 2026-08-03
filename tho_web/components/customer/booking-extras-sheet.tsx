"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { fetchHairstyles } from "@/lib/api/booking";
import { downscaleImage, imageRejection, releasePreview, type PickedImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { Hairstyle, ServiceItem, StaffMember } from "@/lib/types/salon";

/**
 * Review and confirm, ported from `_BookingExtrasSheet`
 * (`tho/app/lib/customer/booking_screen.dart:478`).
 *
 * **Nothing here is uploaded.** The sheet hands its photos back as blobs and the
 * caller uploads them only once the booking exists, so a sheet someone dismisses
 * leaves no orphaned objects in a private bucket. That is the whole reason it takes no
 * client of its own for the photo path.
 */

export type BookingExtras = {
  note: string | null;
  photos: PickedImage[];
  /** Null when the salon isn't Pro, or nothing was picked. */
  hairstyleId: string | null;
};

/** The app's cap on reference photos. */
const MAX_PHOTOS = 3;

export function BookingExtrasSheet({
  open,
  onClose,
  onConfirm,
  service,
  staff,
  timeLabel,
  offerStyles,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (extras: BookingExtras) => void;
  service: ServiceItem;
  staff: StaffMember;
  timeLabel: string;
  /**
   * Whether to show the Pro-only style picker.
   *
   * Gated here **as well as** in `set_booking_hairstyle`, so a customer at a Growth
   * salon is never shown a picker whose result the server would refuse (THO-17). No
   * live salon is on Pro today, so this is normally false.
   */
  offerStyles: boolean;
}) {
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [styles, setStyles] = useState<Hairstyle[]>([]);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !offerStyles) return;
    let live = true;
    // Narrowed to the service's audience so a men's cut doesn't offer updos.
    fetchHairstyles(createClient(), service.gender)
      .then((list) => {
        if (live) setStyles(list);
      })
      .catch(() => {
        // The picker just stays hidden. It is an extra, not a step.
      });
    return () => {
      live = false;
    };
  }, [open, offerStyles, service.gender]);

  /**
   * Every preview URL still on screen, so unmount can release them.
   *
   * Held in a ref and mutated **only in handlers**, never during render. The caller
   * remounts this sheet per opening (a changing `key`), so the form starts empty
   * without anything clearing it — the one thing left to do is revoke the object URLs,
   * which the browser cannot collect on its own.
   */
  const previews = useRef<string[]>([]);
  useEffect(
    () => () => {
      previews.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);

    const room = MAX_PHOTOS - photos.length;
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
      previews.current.push(...accepted.map((p) => p.previewUrl));
      setPhotos((current) => [...current, ...accepted]);
    }
    // Let the same file be picked again after a removal.
    if (fileInput.current) fileInput.current.value = "";
  }

  /** Revoke outside the state updater — an updater must stay pure and can be
   *  re-invoked, which would double-revoke. */
  function removePhoto(photo: PickedImage) {
    releasePreview(photo);
    previews.current = previews.current.filter((url) => url !== photo.previewUrl);
    setPhotos((current) => current.filter((p) => p.previewUrl !== photo.previewUrl));
  }

  return (
    <Sheet open={open} onClose={onClose} title="Review & book">
      <div className="p-base gap-lg flex flex-col">
        <p className="text-body-sm text-muted">
          {service.name} · with {staff.displayName} · {timeLabel}
        </p>

        {styles.length > 0 ? (
          <section>
            <div className="gap-sm mb-xs flex items-center">
              <h3 className="text-title text-ink font-medium">Pick a style</h3>
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
                  selected={styleId === s.id}
                  // Re-tapping clears it: "actually, surprise me" has to stay
                  // reachable once something has been picked.
                  onClick={() => setStyleId((current) => (current === s.id ? null : s.id))}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <label htmlFor="booking-note" className="text-title text-ink mb-sm block font-medium">
            Add a note (optional)
          </label>
          <textarea
            id="booking-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. keep the sides short — going for a clean fade"
            className="border-hairline text-body-md text-ink placeholder:text-muted-soft p-md focus:border-ink w-full rounded-sm border focus:border-2 focus:outline-none"
          />
        </section>

        <section>
          <div className="gap-md mb-sm flex items-center">
            <h3 className="text-title text-ink flex-1 font-medium">Reference photos</h3>
            <Button
              variant="quiet"
              onClick={() => fileInput.current?.click()}
              disabled={photos.length >= MAX_PHOTOS}
            >
              <Icons.addPhoto
                style={{ width: IconSize.xs, height: IconSize.xs }}
                aria-hidden
              />
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
          {photos.length > 0 ? (
            <ul className="gap-sm flex">
              {photos.map((photo, i) => (
                <li key={photo.previewUrl} className="relative">
                  {/* A blob URL, so next/image would only add indirection. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    className="size-18 rounded-sm object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="bg-ink text-on-primary border-canvas absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border-2"
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

        <Button
          fullWidth
          onClick={() =>
            onConfirm({
              note: note.trim() ? note.trim() : null,
              photos,
              hairstyleId: styleId,
            })
          }
        >
          Confirm booking
        </Button>
      </div>
    </Sheet>
  );
}
