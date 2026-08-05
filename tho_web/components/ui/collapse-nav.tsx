"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons, IconSize } from "./icons";
import { useDialogOverlay } from "./use-dialog-overlay";
import { cn } from "@/lib/utils";

/**
 * The navigation that replaced both bottom tab bars.
 *
 * A website's navigation collapses; it does not sit in a thumb-reachable strip glued to
 * the bottom of the viewport. That strip is a phone-app idiom, and on a desktop browser
 * it was the single clearest tell that this app was a port.
 *
 * ## Modelled on the marketing site, with its six gaps closed
 *
 * The visual behaviour is `landing_page`'s: an opaque full-viewport panel revealed by a
 * `clip-path` circle expanding from the button that opened it, with the rows rising in a
 * stagger. What is *not* inherited is its accessibility — that panel has no
 * `aria-expanded`, no `aria-controls`, no `role="dialog"`, no Escape handler, no focus
 * trap and no focus restoration. Its own sibling file admits as much in a comment. All
 * six come from `useDialogOverlay` and the wiring below.
 *
 * ## Why the ids come from a hook
 *
 * `useCollapseNav` returns matched `buttonProps` / `panelProps` from one `useId`, so
 * `aria-expanded`, `aria-controls` and `aria-haspopup` **cannot** be wired wrong or
 * forgotten by either of the two shells that use this. Two callers is exactly where that
 * kind of thing drifts.
 *
 * ## No animation library
 *
 * `landing_page` uses `motion` for the reveal, the stagger and the scroll state. Measured
 * against framer-motion's own size rollups that is ~46 kB gzip, in a layout-level client
 * component — so it would land in the shared chunk for every one of the 46 shelled routes,
 * to animate four things CSS does natively. The reveal is `--animate-nav-reveal` with its
 * origin passed in as a custom property; the stagger is `animation-delay` off a `--i`
 * index. Both are covered by the global `prefers-reduced-motion` block, which
 * `landing_page`'s header is not.
 *
 * The one thing lost is an exit animation, since CSS cannot animate an unmount. The panel
 * is dismissed *by* the user, so it needs no farewell.
 */

export type CollapseNav = {
  open: boolean;
  toggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  close: () => void;
  buttonProps: {
    "aria-expanded": boolean;
    "aria-controls": string | undefined;
    "aria-haspopup": "dialog";
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  };
  panelProps: {
    id: string;
    open: boolean;
    onClose: () => void;
    origin: { x: number; y: number } | null;
  };
};

export function useCollapseNav(): CollapseNav {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    // The reveal grows from the button, so the panel has to know where the button was.
    // Read at press time rather than from a ref on every render: it only matters once,
    // and a sticky header's position changes as the page scrolls.
    const box = event.currentTarget.getBoundingClientRect();
    setOrigin({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    setOpen((wasOpen) => !wasOpen);
  }, []);

  return {
    open,
    toggle,
    close,
    buttonProps: {
      "aria-expanded": open,
      // Only while open: pointing at an element that is not in the document is worse
      // than saying nothing.
      "aria-controls": open ? id : undefined,
      "aria-haspopup": "dialog",
      onClick: toggle,
    },
    panelProps: { id, open, onClose: close, origin },
  };
}

/** The hamburger, which becomes a close button while the panel is open. */
export function CollapseNavButton({
  nav,
  label = "Menu",
  /** A dot for unread counts the header is not already showing. */
  dot = false,
  className,
}: {
  nav: CollapseNav;
  label?: string;
  dot?: boolean;
  className?: string;
}) {
  const Glyph = nav.open ? Icons.close : Icons.menu;
  return (
    <button
      type="button"
      {...nav.buttonProps}
      aria-label={nav.open ? "Close menu" : dot ? `${label} — unread` : label}
      className={cn(
        "text-ink hover:bg-ink/5 relative grid size-11 shrink-0 place-items-center rounded-full",
        "ring-hairline ring-1 ring-inset transition-colors duration-[var(--duration-fast)]",
        className,
      )}
    >
      <Glyph style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
      {dot && !nav.open ? (
        <span className="bg-rausch absolute top-2 right-2 size-2 rounded-full" aria-hidden />
      ) : null}
    </button>
  );
}

/**
 * The panel. Opaque and full-viewport, so there is no *backdrop* in the usual sense —
 * dismissal is Escape, the close button, following a link, or clicking the panel's own
 * empty space.
 *
 * **That last one is what "click outside to close" means for a full-screen menu.** There is
 * no page showing around the edges to click, so the rule is inverted: a click that lands on
 * a link, a button or a form control is an interaction and is left alone; anything else —
 * the margin beside a row, the space under the last one, the header band next to the title
 * — is the user pointing at not-the-menu, and closes it. Checked with `closest` rather than
 * by comparing against the event's own target, so a click on the icon *inside* a row still
 * counts as a click on the row.
 */
export function CollapseNavPanel({
  id,
  open,
  onClose,
  origin,
  title,
  children,
  footer,
  closeAbove = 1128,
}: CollapseNav["panelProps"] & {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * The width at or above which the caller's destinations are on screen by themselves, so
   * this panel must get out of the way. Match it to the caller's own collapse breakpoint —
   * 1128 for the customer shell, 1024 for the owner console.
   */
  closeAbove?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = `${id}-title`;

  useDialogOverlay({ open, onClose, panel });

  // Crossing into a width where the destinations are on screen anyway must close this, or
  // an open overlay is left covering a nav that is already visible behind it. Rotating a
  // phone is the ordinary way to hit that; dragging a desktop window across the breakpoint
  // is the other, and it is the one that leaves a hamburger menu open over a header that no
  // longer has a hamburger.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia(`(min-width: ${closeAbove}px)`);
    // Checked on mount too, not only on change: `open` can be set by a click that lands in
    // the same frame as a resize, and a listener that has not fired yet is not a state.
    if (wide.matches) {
      onClose();
      return;
    }
    const onChange = () => {
      if (wide.matches) onClose();
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open, onClose, closeAbove]);

  /** Anything that is not an interaction is a dismissal. See the note above. */
  const onPanelClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const hit = event.target as HTMLElement | null;
      if (hit?.closest("a[href],button,input,select,textarea,label")) return;
      onClose();
    },
    [onClose],
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panel}
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onClick={onPanelClick}
      style={
        origin
          ? ({
              "--nav-origin-x": `${origin.x}px`,
              "--nav-origin-y": `${origin.y}px`,
            } as React.CSSProperties)
          : undefined
      }
      className="bg-canvas animate-nav-reveal fixed inset-0 z-50 flex flex-col outline-none"
    >
      {/* These three share the header's gutters and, like it, no width cap: the close
          button has to land where the menu button that opened it was, and the header is
          full-bleed. */}
      <div className="px-base tablet:px-lg flex h-16 w-full shrink-0 items-center">
        <h2 id={titleId} className="text-display-sm text-ink flex-1 font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="text-ink hover:bg-ink/5 ring-hairline grid size-11 place-items-center rounded-full ring-1 ring-inset"
        >
          <Icons.close style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
        </button>
      </div>

      <div className="px-base tablet:px-lg pb-lg w-full flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>

      {footer ? (
        <div className="border-hairline-soft px-base tablet:px-lg py-base w-full shrink-0 border-t pb-[calc(var(--spacing-base)+env(safe-area-inset-bottom))]">
          {footer}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

/**
 * One row in the panel. Large type, because at 390px this is the whole navigation and a
 * 14px row would be a phone-app list rather than a website's menu.
 *
 * `index` drives the stagger through a CSS custom property rather than an inline delay, so
 * the timing lives in `globals.css` with the keyframes it belongs to.
 */
export function CollapseNavRow({
  index,
  current = false,
  children,
}: {
  index: number;
  current?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className="animate-nav-row border-hairline-soft border-b"
      style={{ "--i": index, animationDelay: "calc(var(--i) * 45ms)" } as React.CSSProperties}
    >
      <span
        className={cn(
          "flex items-center gap-3 py-4 text-[1.375rem] font-semibold tracking-tight",
          current ? "text-rausch-cta" : "text-ink",
        )}
      >
        {children}
      </span>
    </li>
  );
}
