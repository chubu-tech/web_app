"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/marketing/utils";

type Variant = "primary" | "ink" | "ghost" | "light";

/**
 * Four fills, and the accent is spent on exactly one of them.
 *
 * `primary` is `--color-rausch-cta` (#e00b41), **not** `--color-rausch` (#ff385c).
 * That is not a shade preference: white on #ff385c measures 3.53:1 and fails WCAG
 * AA, and the deeper step measures 4.89:1. `globals.css` states the rule and this is
 * the only place on the public site that puts white text on a brand fill, so it is
 * the only place it matters. #ff385c stays THO's accent everywhere it is a *colour*
 * rather than a *background under white* — the wordmark, rules, dots, active states,
 * icon tints, the search orb's ring.
 *
 * `ghost` is the reference's `button-secondary`: canvas fill, ink label, a 1px
 * stroke that darkens on hover. `light` is the same idea over photography.
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-rausch-cta text-white hover:bg-rausch-cta-pressed",
  ink: "bg-ink text-white hover:bg-obsidian",
  ghost:
    "bg-canvas text-ink ring-1 ring-inset ring-border-strong hover:ring-ink hover:bg-surface-soft",
  light:
    "bg-white/14 text-white ring-1 ring-inset ring-white/30 backdrop-blur-md hover:bg-white/24",
};

/**
 * Two heights, and only two, so every call to action on the page is one of a pair.
 *
 * 48px is the reference's `button-primary` height and its stated touch-target
 * floor; 56px is the same button given the room a closing band wants. The label
 * steps 15 → 16px with it and the weight stays 500 at both — the reference sets
 * `button-md` at 16/500 and `button-sm` at 14/500, and never goes heavier.
 */
const SIZES = {
  md: "h-12 px-6 text-ui",
  lg: "h-14 px-7 text-body-md",
} as const;

/**
 * The page's one button.
 *
 * **It no longer moves.** It used to be magnetic — a spring that leaned the pill a
 * few pixels toward the cursor and sprang back, plus an arrow that lifted
 * diagonally. Two reasons it went. The reference documents its press state as
 * "no transform, no shadow change", and a pill that dodges the pointer is the
 * opposite of the restraint the rest of this redesign is built on. And it made every
 * call to action on the site a `motion` component with two springs and a
 * `pointermove` handler, on a page that has eleven of them.
 *
 * What is left is a colour transition, which is what the reference specifies.
 *
 * Pass `href` for a link, or `onClick` for a real `<button>`. `arrow` now defaults
 * to **false** — the reference's buttons carry a label and nothing else — but the
 * prop is kept because the two "keep reading" links in the hero are genuinely
 * directional and read better with one.
 */
type Common = {
  children: React.ReactNode;
  variant?: Variant;
  size?: keyof typeof SIZES;
  arrow?: boolean;
  className?: string;
};

type AsLink = Common & { href: string; onClick?: never; type?: never; disabled?: never };
type AsButton = Common & {
  href?: never;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
};

export function Button(props: AsLink | AsButton) {
  const {
    children,
    variant = "primary",
    size = "md",
    arrow = false,
    className,
  } = props;

  const classes = cn(
    "group/btn inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium",
    "transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
    SIZES[size],
    VARIANTS[variant],
    "disabled:pointer-events-none disabled:opacity-50",
    className,
  );

  const inner = (
    <>
      <span className="truncate">{children}</span>
      {arrow && (
        <ArrowUpRight
          className="size-[1.15em] shrink-0 transition-transform duration-200 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5"
          strokeWidth={2}
          aria-hidden
        />
      )}
    </>
  );

  if (props.href !== undefined) {
    return (
      <a href={props.href} className={classes}>
        {inner}
      </a>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={classes}
    >
      {inner}
    </button>
  );
}
