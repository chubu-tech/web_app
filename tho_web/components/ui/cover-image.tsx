"use client";

import Image from "next/image";
import { useState } from "react";
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

/** Seeded by the first code unit of the label, exactly as the Dart does, so a
 *  given salon always gets the same colours on both platforms. */
const PALETTES = [
  "from-[#FFE1E8] to-[#FFB3C4]",
  "from-[#FFE9D6] to-[#FFC59E]",
  "from-[#E7E1FF] to-[#C3B3FF]",
  "from-[#DFF3EA] to-[#A7DCC5]",
  "from-[#FDE7F3] to-[#F3B3D6]",
] as const;

function paletteFor(label: string): string {
  const seed = label.length === 0 ? 0 : label.charCodeAt(0);
  return PALETTES[seed % PALETTES.length]!;
}

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
            paletteFor(label),
          )}
        >
          {/* Decorative: the salon's name is always in the text beside this. */}
          <span
            aria-hidden
            className="text-ink/55 text-[2.5rem] leading-none font-bold"
          >
            {(label.trim()[0] ?? "?").toUpperCase()}
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
