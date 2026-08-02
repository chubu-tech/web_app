import { brand } from "@/lib/content";
import { cn } from "@/lib/utils";

/** Apple's logo mark. */
function AppleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6 shrink-0", className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/** Google Play's four-colour mark. */
function PlayMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6 shrink-0", className)}
      aria-hidden
    >
      <path d="M2.4 1.6a1.5 1.5 0 0 0-.4 1.03v18.74a1.5 1.5 0 0 0 .4 1.03l9.5-10.4z" fill="#00C3FF" />
      <path d="M2.4 1.6a1.4 1.4 0 0 1 1.42-.06l11.6 6.53-3.52 3.86z" fill="#00E177" />
      <path d="M15.42 8.07l3.9 2.2a1.5 1.5 0 0 1 0 2.62l-3.93 2.21-3.49-3.83z" fill="#FFCE00" />
      <path d="M11.9 11.9l3.49 3.83-11.57 6.51a1.4 1.4 0 0 1-1.42-.06z" fill="#FF3A44" />
    </svg>
  );
}

/**
 * App Store + Google Play buttons. Each badge is a real link once the store
 * URLs land in `brand.stores`; until then it falls back to the page's download
 * section so nothing is a dead link.
 */
export function StoreBadges({
  className,
  tone = "ink",
}: {
  className?: string;
  /** `ink` on light backgrounds, `light` over photography. */
  tone?: "ink" | "light";
}) {
  const badges = [
    {
      mark: <AppleMark className={tone === "ink" ? "text-white" : "text-white"} />,
      top: "Download on the",
      store: "App Store",
      href: brand.stores.ios || "#download",
      label: `Download ${brand.appName} on the App Store`,
    },
    {
      mark: <PlayMark />,
      top: "Get it on",
      store: "Google Play",
      href: brand.stores.android || "#download",
      label: `Get ${brand.appName} on Google Play`,
    },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {badges.map((badge) => (
        <a
          key={badge.store}
          href={badge.href}
          aria-label={badge.label}
          className={cn(
            // The min-width keeps both badges the same size when they stack.
            "group/badge flex min-w-[11rem] items-center gap-3 rounded-2xl px-4 py-2.5",
            "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5",
            tone === "ink"
              ? "bg-ink text-white hover:bg-obsidian"
              : "bg-white/12 text-white ring-1 ring-white/25 ring-inset backdrop-blur-md hover:bg-white/20",
          )}
        >
          {badge.mark}
          <span className="text-left">
            <span className="block text-[0.625rem] tracking-[0.08em] text-white/65 uppercase">
              {badge.top}
            </span>
            <span className="block text-[0.9375rem] leading-tight font-semibold">
              {badge.store}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
