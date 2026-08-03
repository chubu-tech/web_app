/**
 * Picking and preparing an image in the browser.
 *
 * The Flutter app leans on `image_picker`, which downscales during the pick
 * (`image_upload.dart:19` — `maxWidth: 1600, imageQuality: 85`). The web has no
 * equivalent, so this does the same two jobs explicitly: **validate** to the app's
 * own rules, then **downscale** on a canvas before anything is uploaded.
 *
 * Downscaling client-side is not a nicety. A modern phone photo is 4–12 MB; the app's
 * cap is 8 MB, and these go to a private bucket over whatever connection a customer
 * in Thimphu happens to have.
 */

/** Exactly `_allowedImageTypes` in `api.dart:130`. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Exactly `_maxUploadBytes` in `api.dart:137`. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** `maxWidth` / `imageQuality` from `pickImageBytes`. */
export const MAX_WIDTH = 1600;
export const JPEG_QUALITY = 0.85;

/** A picked, downscaled image, held in memory until something commits it. */
export type PickedImage = {
  blob: Blob;
  mime: string;
  /** For an `<img>` preview. Revoke it when the picker is torn down. */
  previewUrl: string;
};

/**
 * Reject a file before it costs anyone a round trip.
 *
 * Returns the reason as a sentence, or null when the file is fine. Mirrors
 * `_validateImage`, which throws — here the caller shows the sentence instead.
 */
export function imageRejection(file: File): string | null {
  const type = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "That file isn't an image we can use — try a JPEG, PNG or WebP.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "That image is too large (max 8 MB).";
  }
  return null;
}

/**
 * Downscale to at most {@link MAX_WIDTH} wide and re-encode as JPEG.
 *
 * Always re-encodes, even for an already-small image: HEIC comes off an iPhone and
 * most browsers cannot display it, so a photo that uploaded fine would render as a
 * broken thumbnail for the salon. Going through a canvas normalises the format as a
 * side effect of the resize.
 *
 * Falls back to the original bytes if the browser cannot decode the file at all —
 * better a large upload than a lost photo.
 */
export async function downscaleImage(file: File): Promise<PickedImage> {
  const original: PickedImage = {
    blob: file,
    mime: file.type || "image/jpeg",
    previewUrl: URL.createObjectURL(file),
  };

  if (typeof document === "undefined") return original;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return original;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return original;

    URL.revokeObjectURL(original.previewUrl);
    return {
      blob,
      mime: "image/jpeg",
      previewUrl: URL.createObjectURL(blob),
    };
  } catch {
    // An undecodable file (an unsupported HEIC, a corrupt JPEG). It already passed
    // the size and type checks, so let the upload try.
    return original;
  }
}

/** Release a preview URL. Every `PickedImage` holds one. */
export function releasePreview(image: PickedImage) {
  URL.revokeObjectURL(image.previewUrl);
}
