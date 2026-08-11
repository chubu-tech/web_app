"use client";

import { useEffect, type RefObject } from "react";

/**
 * The behaviour that makes an overlay a *dialog* rather than a div on top of the page:
 * scroll lock, focus in, Escape, a Tab trap, and focus restored to whatever opened it.
 *
 * **Extracted from `Sheet` rather than reimplemented.** `Sheet` had all five and the
 * collapse nav needs all five, and the alternative was a second copy — which is exactly
 * the drift the marketing site demonstrates: its mobile nav sheet has none of them, and
 * the doc comment on its own search panel says so out loud (*"the one existing overlay
 * (the mobile nav sheet) has no Escape handler and no focus management"*). One
 * implementation means the nav cannot fall behind the sheet, or the reverse.
 *
 * It is only the *behaviour*. Markup, shape and dismissal affordances stay with each
 * caller, because a bottom sheet and a full-viewport nav panel look nothing alike — which
 * is why this is a hook and not a `variant` prop on `Sheet`.
 *
 * The caller still owns:
 * - the portal, `role="dialog"`, `aria-modal` and the accessible name
 * - `tabIndex={-1}` on the panel, or `panel.current?.focus()` has nothing to focus
 * - any backdrop, and any close button
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogOverlay({
  open,
  onClose,
  panel,
}: {
  open: boolean;
  onClose: () => void;
  /** The dialog element. Needs `tabIndex={-1}` so it can take focus itself. */
  panel: RefObject<HTMLElement | null>;
}): void {
  useEffect(() => {
    if (!open) return;

    // Remember who opened this, so focus can go back there on close. Without it the caret
    // lands at the top of the document and a keyboard user has to walk the whole page
    // again to get back to where they were.
    const opener = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the panel itself rather than its first control: an overlay that opens with the
    // caret already inside a text field hides its own title from a screen reader, which is
    // the one thing that says what just happened.
    panel.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // Stop it here so one Escape closes one layer. A facet panel inside a sheet must
        // not take the sheet down with it.
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;

      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        // Nothing to move to — keep the caret on the panel rather than letting it escape
        // to the page behind.
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
    // `panel` is a ref, stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}
