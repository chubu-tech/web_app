"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Icons, IconSize } from "./icons";
import { cn } from "@/lib/utils";

/**
 * A modal sheet — filters, galleries, confirmations.
 *
 * **This one is not a port.** The Flutter app reaches for `showModalBottomSheet`,
 * which gets focus handling and dismissal from the framework; the browser gives
 * you none of that. So the accessibility here is written out explicitly:
 *
 * - `role="dialog"` + `aria-modal`, labelled by its own title
 * - **Escape closes it**
 * - **focus moves in on open and is restored to the opener on close** — the app's
 *   sheets and the admin console's mobile nav both leave focus stranded behind the
 *   scrim; do not inherit that
 * - **Tab is trapped**, so you cannot tab into the page underneath
 * - background scroll is locked, and a backdrop click dismisses
 *
 * Shape follows the breakpoint, per DESIGN.md's collapsing strategy: a bottom
 * sheet under 744 (thumb reach), a centred dialog at or above it — a sheet glued
 * to the bottom of a 1400px window is a phone artefact.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  /** Fills the viewport rather than hugging its content — the photo lightbox. */
  fullBleed = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  fullBleed?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    // Remember who opened this, so focus can go back there on close. Without it
    // the caret lands at the top of the document and a keyboard user has to walk
    // the whole page again to get back to where they were.
    const opener = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the panel itself rather than its first control: a sheet that opens
    // with the caret already inside a text field hides the title from a screen
    // reader, which is the one thing that says what just happened.
    panel.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;

      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        // Nothing to move to — keep the caret on the panel rather than letting
        // it escape to the page behind the scrim.
        event.preventDefault();
        return;
      }

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center tablet:items-center">
      {/* Decorative scrim. Dismissal is also on Escape and the Close button, so
          this is not the only way out and needs no role of its own. */}
      <div
        className="scrim absolute inset-0"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "bg-canvas relative flex w-full flex-col outline-none",
          "rounded-t-lg tablet:rounded-lg",
          fullBleed
            ? "h-full tablet:h-[85vh] tablet:max-w-4xl"
            : "max-h-[90vh] tablet:max-h-[85vh] tablet:max-w-lg",
        )}
      >
        <div className="border-hairline-soft px-base gap-md flex min-h-14 shrink-0 items-center border-b">
          <h2 id={titleId} className="text-display-sm text-ink flex-1 font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink -mr-2 flex size-12 items-center justify-center rounded-full"
          >
            <Icons.close style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer ? (
          <div className="border-hairline-soft p-base shrink-0 border-t">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
