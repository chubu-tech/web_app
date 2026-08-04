"use client";

import Image from "next/image";
import { useState } from "react";
import { monogramInitial, paletteFor } from "@/lib/monogram";
import { cn } from "@/lib/utils";

/**
 * A salon cover / hero banner, ported from `tho/app/lib/ui/widgets/cover_image.dart`.
 *
 * When there is no image — or the one on record fails to load — it renders a soft
 * brand-tinted gradient carrying the label's initial, so **every salon reads as
 * photo-forward even before a cover is uploaded**. 4 of the 13 live salons have no
 * cover, so this is the common path, not the edge case.
 *
 * The `onError` fallback is the port of Flutter's `errorBuilder`, and it doubles as
 * the safety net for an image host that isn't in `next.config.ts`'s
 * `remotePatterns`: `next/image` rejects the request, the browser fires `error`,
 * and the viewer gets the monogram instead of a broken-image glyph.
 */

export type CoverImageProps = {
  label: string;
  imageUrl?: string | null;
  /** Passed straight to `next/image`; describes the rendered box, not the source. */
  sizes?: string;
  /** Load this one eagerly — the hero above the fold, never a card in a row. */
  priority?: boolean;
  /** Applies to the wrapper, which is `relative` and must be given a size. */
  className?: string;
};

export function CoverImage({
  label,
  imageUrl,
  sizes = "100vw",
  priority = false,
  className,
}: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !imageUrl || failed;

  return (
    <div className={cn("bg-surface-strong relative overflow-hidden", className)}>
      {showFallback ? (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br",
            paletteFor(label).className,
          )}
        >
          {/* Decorative: the salon's name is always in the text beside this. */}
          <span
            aria-hidden
            className="text-ink/55 text-[2.5rem] leading-none font-bold"
          >
            {monogramInitial(label)}
          </span>
        </div>
      ) : (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
