import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { CoverImage } from "./cover-image";
import { IconSize } from "./icons";
import { cn } from "@/lib/utils";

/**
 * Salon-detail building blocks, ported from
 * `tho/app/lib/customer/detail_sections.dart`. Kept free of any data access so
 * they stay trivially testable, as the Dart originals are.
 */

/**
 * The label row with a coral underline on the active tab.
 *
 * **Keyed by label, never by index.** Shop only exists when the salon has in-stock
 * products, so a positional index points at the wrong body whenever it is absent —
 * the reasoning is written out at `business_detail_screen.dart:529-536`.
 *
 * `role="tablist"` with `aria-controls` so the pairing is real to a screen reader,
 * not just visual.
 */
export function DetailTabBar({
  labels,
  active,
  onChange,
  panelId,
}: {
  labels: string[];
  active: string;
  onChange: (label: string) => void;
  /** Id of the panel these tabs drive. */
  panelId: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Salon sections"
      className="border-hairline-soft gap-lg flex overflow-x-auto border-b"
    >
      {labels.map((label) => {
        const isActive = label === active;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            id={`tab-${label}`}
            aria-selected={isActive}
            aria-controls={panelId}
            onClick={() => onChange(label)}
            className={cn(
              "text-caption relative shrink-0 pb-2 pt-3 font-medium whitespace-nowrap",
              isActive ? "text-rausch-cta" : "text-muted hover:text-ink",
            )}
          >
            {label}
            <span
              aria-hidden
              className={cn(
                "bg-rausch absolute bottom-0 left-1/2 h-[2.5px] -translate-x-1/2 rounded-full",
                "transition-[width] duration-[var(--duration-fast)]",
                isActive ? "w-7" : "w-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * A tinted circular action with a small label under it — the Message / WhatsApp /
 * Call / Directions / Save / Share row.
 *
 * Renders as a link when `href` is given (Call, WhatsApp, Directions all leave the
 * app, and `tel:`/`https:` belong in an anchor so long-press and open-in-new-tab
 * work), otherwise as a button.
 */
export function ActionCircle({
  icon: Icon,
  label,
  href,
  onClick,
  active = false,
  external = false,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  external?: boolean;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)]",
          active ? "bg-rausch-cta text-on-primary" : "bg-rausch/10 text-rausch-cta",
        )}
      >
        <Icon
          style={{ width: IconSize.sm, height: IconSize.sm }}
          className={active ? "fill-current" : undefined}
          aria-hidden
        />
      </span>
      <span className="text-caption-sm text-ink">{label}</span>
    </>
  );

  const shell = "gap-xs flex w-16 shrink-0 flex-col items-center";

  if (href) {
    return (
      <a
        href={href}
        className={shell}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={shell}>
      {body}
    </button>
  );
}

/** Floating circular control over the detail hero (back / share / save). */
export function HeroCircleButton({
  icon: Icon,
  label,
  href,
  onClick,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const cls =
    "bg-canvas/92 shadow-card flex size-11 items-center justify-center rounded-full backdrop-blur-sm";
  const glyph = (
    <Icon
      style={{ width: IconSize.sm, height: IconSize.sm }}
      className={cn(active ? "text-rausch fill-current" : "text-ink")}
      aria-hidden
    />
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        {glyph}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cls}
    >
      {glyph}
    </button>
  );
}

/**
 * Photo card for the Specialists grid.
 *
 * `href` is optional on purpose: it was written before `/stylist/[id]` existed, because
 * a card linking to a route that does not exist yet is worse than one that doesn't
 * link. 2e landed that route, so the salon page now passes one — and the option stays,
 * because the owner console will show the same grid for staff who have no public page.
 */
export function SpecialistCard({
  name,
  role,
  photoUrl,
  href,
}: {
  name: string;
  role?: string | null;
  photoUrl?: string | null;
  href?: string;
}) {
  return (
    <article className="border-hairline relative overflow-hidden rounded-md border">
      <CoverImage
        label={name}
        imageUrl={photoUrl}
        sizes="(min-width: 744px) 25vw, 50vw"
        className="aspect-square w-full"
      />
      <div className="p-sm">
        <h4 className="text-title text-ink truncate font-medium">
          {href ? (
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              {name}
            </Link>
          ) : (
            name
          )}
        </h4>
        {role ? <p className="text-caption-sm text-muted truncate">{role}</p> : null}
      </div>
    </article>
  );
}

/** A muted meta line with a coral glyph — address, hours, phone. */
export function IconLine({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <p className="text-body-sm text-muted gap-xs flex items-start">
      <Icon
        className="text-rausch mt-0.5 shrink-0"
        style={{ width: IconSize.xxs, height: IconSize.xxs }}
        aria-hidden
      />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
