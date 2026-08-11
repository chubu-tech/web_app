"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

/**
 * A person or salon avatar, ported from
 * `tho/app/lib/ui/widgets/monogram_tile.dart`: the photo when there is one, else
 * initials on a seeded tint. Same `onError` fallback rationale as `CoverImage`.
 */

const TINTS = [
  "bg-[#FFE1E8] text-[#8C1B34]",
  "bg-[#FFE9D6] text-[#8A4B12]",
  "bg-[#E7E1FF] text-[#3E2E8F]",
  "bg-[#DFF3EA] text-[#14603F]",
  "bg-[#FDE7F3] text-[#8A2464]",
] as const;

export function Avatar({
  name,
  photoUrl,
  size = 40,
  square = false,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  /** Rounded square instead of a circle, for a service thumbnail. */
  square?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const tint = TINTS[(name.charCodeAt(0) || 0) % TINTS.length]!;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        square ? "rounded-md" : "rounded-full",
        photoUrl && !failed ? "bg-surface-strong" : tint,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {photoUrl && !failed ? (
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className="font-semibold"
          style={{ fontSize: Math.round(size * 0.38) }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
