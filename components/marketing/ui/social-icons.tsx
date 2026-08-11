import { cn } from "@/lib/marketing/utils";

/**
 * The four social marks, as inline SVG.
 *
 * **Why these are not `lucide-react` imports.** Lucide carried brand icons until
 * v1 dropped them — `Facebook`, `Instagram` and friends are simply not exported
 * any more, and TikTok never was. Every other glyph on this site still comes from
 * lucide; these four are the exception because there is nothing to import.
 *
 * They are **filled**, where lucide is stroked, and that is deliberate rather than
 * an oversight: a brand mark is a logo, not an interface icon. Stroking the TikTok
 * note or the WhatsApp handset at 18px turns both into mush, and a hand-drawn
 * outline approximation of somebody's trademark is worse than the real filled
 * silhouette. They sit in their own tinted circles in the footer, which visually
 * separates them from the stroked lucide set rather than pretending to match it.
 *
 * `viewBox="0 0 24 24"` and `fill="currentColor"` throughout, so size comes from a
 * class and colour is inherited — the same contract lucide's components offer.
 *
 * **The caller sizes the glyph; there is no default.** This used to be
 * `cn("size-full", className)`, and `cn` in this repo is a plain join rather than
 * tailwind-merge — deliberately, see `lib/utils.ts`. So a caller's `size-[18px]` did
 * not *replace* `size-full`, it shipped alongside it and lost on source order: the
 * four marks rendered at the full 40px of their button, overflowing the tinted circle
 * they are supposed to sit inside and leaving the row looking crammed. Measured, not
 * guessed — every glyph came back 40px wide in a 40px box.
 *
 * A default that silently beats the caller is worse than no default, so it is gone.
 * Pass a size class.
 */

type IconProps = { className?: string };

function Glyph({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={cn(className)}
    >
      {children}
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </Glyph>
  );
}

export function TikTokIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
    </Glyph>
  );
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
    </Glyph>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      {/* Drawn geometrically rather than as one long trademark path: a rounded
          square, the lens, and the flash dot. `evenodd` on the frame is what
          hollows it out into a ring instead of a filled tile. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.6 1.5h8.8A6.1 6.1 0 0 1 22.5 7.6v8.8a6.1 6.1 0 0 1-6.1 6.1H7.6a6.1 6.1 0 0 1-6.1-6.1V7.6A6.1 6.1 0 0 1 7.6 1.5Zm0 2.2A3.9 3.9 0 0 0 3.7 7.6v8.8a3.9 3.9 0 0 0 3.9 3.9h8.8a3.9 3.9 0 0 0 3.9-3.9V7.6a3.9 3.9 0 0 0-3.9-3.9H7.6Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 6.7a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 2.2a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Z"
      />
      <circle cx="17.6" cy="6.4" r="1.3" />
    </Glyph>
  );
}

/** Keyed by `footer.social.networks[].key`, so the content list drives the render. */
export const SOCIAL_ICONS = {
  whatsapp: WhatsAppIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
} as const;

export type SocialKey = keyof typeof SOCIAL_ICONS;
