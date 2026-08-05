"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { downscaleImage, imageRejection, releasePreview, type PickedImage } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * Leave a review, ported from `tho/app/lib/ui/widgets/review_sheet.dart`.
 *
 * **Photos come back as blobs, not URLs, and this sheet uploads nothing.** The caller
 * uploads on submit, so a sheet someone dismisses — or a review that fails to write —
 * leaves no orphaned objects in storage. Same discipline as the booking extras sheet,
 * for the same reason.
 *
 * The three-photo cap is a UI convention here and a rule in
 * `create_review_with_photos`; both exist on purpose.
 */
const MAX_PHOTOS = 3;

export type ReviewResult = {
  rating: number;
  body: string;
  photos: PickedImage[];
};

export function ReviewSheet({
  open,
  onClose,
  onSubmit,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (result: ReviewResult) => void;
  busy?: boolean;
}) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Preview URLs still on screen, so unmount can release them. Mutated only in
  // handlers, never during render. See the same note in `booking-extras-sheet.tsx`.
  const previews = useRef<string[]>([]);
  useEffect(
    () => () => {
      previews.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function removePhoto(photo: PickedImage) {
    releasePreview(photo);
    previews.current = previews.current.filter((url) => url !== photo.previewUrl);
    setPhotos((current) => current.filter((p) => p.previewUrl !== photo.previewUrl));
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    const taken = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (taken.length < files.length) setPhotoError(`Up to ${MAX_PHOTOS} photos.`);

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
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Sheet open={open} onClose={onClose} title="Leave a review">
      <div className="p-base gap-lg flex flex-col">
        <fieldset>
          <legend className="sr-only">Your rating out of 5</legend>
          <div className="gap-xs flex justify-center">
            {[1, 2, 3, 4, 5].map((value) => {
              const lit = value <= rating;
              return (
                <label
                  key={value}
                  className="flex size-12 cursor-pointer items-center justify-center"
                >
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    className="sr-only"
                  />
                  <span className="sr-only">
                    {value} star{value === 1 ? "" : "s"}
                  </span>
                  {/* A picker only ever sets whole stars, so it draws the glyph
                      directly rather than going through StarBar's half logic. */}
                  <Icons.star
                    aria-hidden
                    style={{ width: IconSize.xl, height: IconSize.xl }}
                    className={cn(
                      "transition-transform duration-[var(--duration-fast)]",
                      lit
                        ? "text-star scale-100 fill-current drop-shadow-[0_0_12px_rgba(232,163,23,0.35)]"
                        : "text-hairline scale-[0.88]",
                    )}
                  />
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="sr-only">Your review</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Share a few words (optional)"
            className="border-hairline text-body-md text-ink placeholder:text-muted-soft p-md focus:border-ink w-full rounded-sm border focus:border-2 focus:outline-none"
          />
        </label>

        <section>
          <div className="gap-md mb-sm flex items-center">
            {/* A photo of the actual result is the most persuasive thing a review
                carries, so the control is visible from the start rather than hidden
                behind a paperclip. */}
            <h3 className="text-title text-ink flex-1 font-medium">Add photos</h3>
            <Button
              variant="quiet"
              onClick={() => fileInput.current?.click()}
              disabled={photos.length >= MAX_PHOTOS}
            >
              <Icons.camera style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt="" className="size-16 rounded-sm object-cover" />
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
          ) : null}
        </section>

        <Button
          fullWidth
          busy={busy}
          onClick={() => onSubmit({ rating, body: body.trim(), photos })}
        >
          Submit review
        </Button>
      </div>
    </Sheet>
  );
}
