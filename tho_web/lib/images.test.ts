import { describe, expect, it } from "vitest";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, imageRejection } from "./images";

/**
 * The upload gate, mirroring `_validateImage` in `tho/app/lib/data/api.dart:140`.
 *
 * Worth pinning: these limits also exist in storage and in the RPCs, so a mismatch here
 * would mean the customer picks a file, waits for an upload, and *then* gets refused.
 */

const file = (name: string, type: string, size: number): File => {
  const f = new File([new Uint8Array(0)], name, { type });
  // A real multi-megabyte buffer would make the suite slow for no gain.
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("imageRejection", () => {
  it("accepts every type the app accepts", () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(imageRejection(file("photo", type, 1024))).toBeNull();
    }
  });

  it("accepts HEIC, which is what an iPhone actually produces", () => {
    expect(imageRejection(file("IMG_0001.HEIC", "image/heic", 3_000_000))).toBeNull();
  });

  it("is case-insensitive about the mime type", () => {
    expect(imageRejection(file("photo.jpg", "IMAGE/JPEG", 1024))).toBeNull();
  });

  it("refuses a non-image", () => {
    expect(imageRejection(file("notes.pdf", "application/pdf", 1024))).toMatch(/isn't an image/);
    expect(imageRejection(file("clip.mp4", "video/mp4", 1024))).toMatch(/isn't an image/);
  });

  it("refuses a file with no type at all", () => {
    expect(imageRejection(file("mystery", "", 1024))).toMatch(/isn't an image/);
  });

  it("refuses an SVG — it can carry script, and it is not a photo", () => {
    expect(imageRejection(file("logo.svg", "image/svg+xml", 1024))).toMatch(/isn't an image/);
  });

  it("accepts a file exactly at the 8 MB cap", () => {
    expect(imageRejection(file("big.jpg", "image/jpeg", MAX_UPLOAD_BYTES))).toBeNull();
  });

  it("refuses a file one byte over the cap", () => {
    expect(imageRejection(file("big.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1))).toMatch(
      /too large/,
    );
  });
});
