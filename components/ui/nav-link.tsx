import Link from "next/link";
import { IconSize, type Icons } from "./icons";
import { cn } from "@/lib/utils";

/**
 * One inline destination in the header, in `../landing_page`'s treatment.
 *
 * **This exists because the class string was in two files.** `customer-nav.tsx` and
 * `owner-nav.tsx` each carried the same literal — `text-title px-md gap-sm flex min-h-11
 * items-center rounded-full font-medium` plus a current/hover branch — so restyling the
 * nav meant editing it twice and the two would have drifted on the first divergent tweak.
 * One component, both shells.
 *
 * ## What is borrowed from the marketing site, and what is not
 *
 * Borrowed, because it is the interaction that makes the two sites feel like one product:
 *
 * - **A rausch underline that grows from the left on hover.** `site-header.tsx` draws it
 *   with an `after:` pseudo-element going from zero width to the label's width, over 300ms
 *   on the marketing site's single easing curve. Same here.
 * - **The two-layer label slide.** The resting label rises out of the top while an ink-
 *   coloured copy rises from below to replace it, 400ms on the same curve. The second copy
 *   is `aria-hidden`, so a screen reader hears the destination once.
 *
 * Not borrowed:
 *
 * - **The icon does not slide.** The marketing site's links are text-only; these carry a
 *   glyph and, on Messages, a count. Sliding a two-layer stack that contains an icon and a
 *   badge means duplicating both, and the badge is a live number — two copies of it is one
 *   copy too many. So the glyph holds still and the words move.
 * - **A persistent active state.** The marketing site has none to borrow: it is one page of
 *   anchors, so no link is ever "current". `aria-current` is real here, and it reads as the
 *   underline already at full width with ink text — the hover state, held. That keeps one
 *   visual language rather than introducing a filled pill the marketing site never uses.
 */
export function NavLink({
  href,
  label,
  icon: Icon,
  current,
  children,
}: {
  href: string;
  label: string;
  icon: (typeof Icons)[keyof typeof Icons];
  current: boolean;
  /** The count badge, when a destination has one. */
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group/nav gap-sm px-md relative flex min-h-11 items-center rounded-full",
        // NOT the font size — see the note on the label span. Only weight and colour here.
        "font-medium",
        // The underline. `left-3` and the width calc keep it inside the horizontal
        // padding, so it spans the label rather than the whole hit area.
        "after:bg-rausch after:absolute after:bottom-1.5 after:left-3 after:h-px",
        // `width` is the only thing that moves — the blanket form here also animated the
        // pseudo-element's colour and position for no reason.
        "after:transition-[width] after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)]",
        current
          ? "text-ink after:w-[calc(100%-1.5rem)]"
          : "text-muted hover:text-ink after:w-0 hover:after:w-[calc(100%-1.5rem)]",
      )}
    >
      <Icon
        style={{ width: IconSize.xs, height: IconSize.xs }}
        strokeWidth={current ? 2.2 : 1.8}
        aria-hidden
        className="shrink-0"
      />

      {/*
        The label, in two layers. `overflow-hidden` is on this span rather than the link,
        because the link also hosts the underline and the badge — clipping at the link would
        cut both.

        **`text-title` is here and not in the link's `cn` call, and that is not a style
        choice.** `cn` is `twMerge`, and tailwind-merge does not know this project's type
        scale: it has no `title` in its font-size list, so it reads `text-title` as a
        *colour* and the `text-muted`/`text-ink` branch below wins on being last. The class
        is deleted before it reaches the DOM. Measured — the rendered `class` attribute had
        `font-medium` and no size at all, so both shells' nav links inherited `body`'s 16px
        where `../landing_page` sets 15px (`text-[0.9375rem]` in `site-header.tsx`).
        `text-title` is 0.9375rem, i.e. exactly that, and it brings the token's own tracking
        with it.

        This span has no colour class, so nothing here conflicts and the token survives. The
        icon and the badge carry their own sizes (`IconSize`, `text-badge`), so the link
        itself never needs a font size.

        The same trap applies to all ten `--text-*` tokens at 40 `cn` call sites across the
        app. See the note on `cn` in `lib/utils.ts`.
      */}
      <span className="text-title relative inline-block overflow-hidden">
        <span className="block transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:-translate-y-[130%]">
          {label}
        </span>
        <span
          aria-hidden
          className="text-ink absolute inset-0 flex translate-y-[130%] items-center transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:translate-y-0"
        >
          {label}
        </span>
      </span>

      {children}
    </Link>
  );
}
