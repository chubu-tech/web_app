"use client";

import Image from "next/image";
import { useState } from "react";
import { Icons, IconSize } from "./icons";
import { ReportButton } from "./report-button";
import { Sheet } from "./sheet";
import type { ReportRef } from "@/lib/api/moderation";
import { cn } from "@/lib/utils";

/**
 * A salon gallery or a review's photos, ported from
 * `tho/app/lib/ui/widgets/photo_collage.dart` and `photo_strip.dart`.
 *
 * Collapsed to at most `maxTiles` square thumbnails with `+N` on the last; tapping
 * any tile opens the full set. Renders nothing for an empty list, so callers do not
 * need to guard — and only 1 of 13 live salons has a gallery, so that is the usual
 * outcome.
 *
 * The viewer is the shared `Sheet`, so it inherits Escape, the focus trap and focus
 * restoration rather than being a second, almost-alike modal.
 */
export function PhotoCollage({
  urls,
  maxTiles = 3,
  title = "Photos",
}: {
  urls: string[];
  maxTiles?: number;
  title?: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (urls.length === 0) return null;

  const shown = urls.slice(0, maxTiles);
  const hidden = urls.length - shown.length;

  return (
    <>
      <ul className="gap-sm grid grid-cols-3">
        {shown.map((url, i) => (
          <li key={url + i}>
            <button
              type="button"
              onClick={() => setOpenAt(i)}
              aria-label={`Photo ${i + 1} of ${urls.length}`}
              className="bg-surface-strong relative block aspect-square w-full overflow-hidden rounded-md"
            >
              <Thumb url={url} />
              {i === shown.length - 1 && hidden > 0 ? (
                <span className="scrim text-display-sm text-on-primary absolute inset-0 flex items-center justify-center font-semibold">
                  +{hidden}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={openAt != null}
        onClose={() => setOpenAt(null)}
        title={title}
        fullBleed
      >
        <ul className="gap-base p-base grid grid-cols-2 tablet:grid-cols-3">
          {urls.map((url, i) => (
            <li
              key={url + i}
              className="bg-surface-strong relative aspect-square overflow-hidden rounded-md"
            >
              <Thumb url={url} priority={i === openAt} />
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

/**
 * A horizontal strip of square thumbnails — review photos, booking attachments.
 *
 * `reportTargets` is index-aligned with `urls` and optional, which is what keeps the two
 * kinds of caller apart: a review's photos are public content somebody may need to report,
 * and a booking's reference photos are a private instruction to one stylist with no
 * audience to protect. Passing nothing renders exactly what it always did.
 */
export function PhotoStrip({
  urls,
  size = 72,
  reportTargets,
}: {
  urls: string[];
  size?: number;
  /** One per url; `null` for a photo with nothing to report it by. */
  reportTargets?: (ReportRef | null)[];
}) {
  if (urls.length === 0) return null;
  return (
    <ul className="gap-sm flex overflow-x-auto">
      {urls.map((url, i) => {
        const report = reportTargets?.[i] ?? null;
        return (
          <li
            key={url + i}
            className="bg-surface-strong relative shrink-0 overflow-hidden rounded-md"
            style={{ width: size, height: size }}
          >
            <Thumb url={url} sizes={`${size}px`} />
            {/* On the photograph rather than beside it: a strip scrolls, so a control in
                the flow would scroll away from the thing it refers to. */}
            {report ? (
              <div className="absolute top-0.5 right-0.5">
                <ReportButton
                  target={report.target}
                  targetId={report.targetId}
                  label={report.label}
                  variant="overlay"
                  className="size-7"
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Thumb({
  url,
  sizes = "(min-width: 744px) 33vw, 50vw",
  priority = false,
}: {
  url: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="bg-surface-strong flex h-full w-full items-center justify-center">
        <Icons.imageMissing
          className="text-muted-soft"
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      </span>
    );
  }
  return (
    <Image
      src={url}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover")}
      onError={() => setFailed(true)}
    />
  );
}
